import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/utils";
import {
  recalculateTrainerMonthSplits,
  getPaymentCollectionDate,
} from "@/lib/services/trainer-split";
import type { SplitRuleMode, TrainerSplitRule } from "@prisma/client";

export type SplitRuleDTO = {
  id: string;
  employeeId: string;
  startMonth: number;
  startYear: number;
  endMonth: number | null;
  endYear: number | null;
  mode: SplitRuleMode;
  flatPercent: number | null;
  monthlyTarget: number | null;
  splitBelowTarget: number | null;
  splitAboveTarget: number | null;
  notes: string | null;
};

export type CreateSplitRuleInput = {
  startMonth: number;
  startYear: number;
  endMonth?: number | null;
  endYear?: number | null;
  mode: SplitRuleMode;
  flatPercent?: number | null;
  monthlyTarget?: number | null;
  splitBelowTarget?: number | null;
  splitAboveTarget?: number | null;
  notes?: string | null;
};

function monthOrdinal(month: number, year: number): number {
  return year * 12 + month;
}

function ruleToDto(rule: TrainerSplitRule): SplitRuleDTO {
  return {
    id: rule.id,
    employeeId: rule.employeeId,
    startMonth: rule.startMonth,
    startYear: rule.startYear,
    endMonth: rule.endMonth,
    endYear: rule.endYear,
    mode: rule.mode,
    flatPercent: rule.flatPercent !== null ? decimalToNumber(rule.flatPercent) : null,
    monthlyTarget: rule.monthlyTarget !== null ? decimalToNumber(rule.monthlyTarget) : null,
    splitBelowTarget:
      rule.splitBelowTarget !== null ? decimalToNumber(rule.splitBelowTarget) : null,
    splitAboveTarget:
      rule.splitAboveTarget !== null ? decimalToNumber(rule.splitAboveTarget) : null,
    notes: rule.notes,
  };
}

export async function listSplitRules(employeeId: string): Promise<SplitRuleDTO[]> {
  const rules = await prisma.trainerSplitRule.findMany({
    where: { employeeId },
    orderBy: [{ startYear: "asc" }, { startMonth: "asc" }],
  });
  return rules.map(ruleToDto);
}

function validateRuleInput(input: CreateSplitRuleInput): string | null {
  if (input.startMonth < 1 || input.startMonth > 12) return "Invalid start month";
  if (input.endMonth != null && (input.endMonth < 1 || input.endMonth > 12)) {
    return "Invalid end month";
  }
  if (input.endMonth != null && input.endYear == null) return "End year required when end month set";
  if (input.endMonth == null && input.endYear != null) return "End month required when end year set";

  const start = monthOrdinal(input.startMonth, input.startYear);
  const end =
    input.endMonth != null && input.endYear != null
      ? monthOrdinal(input.endMonth, input.endYear)
      : null;
  if (end !== null && end < start) return "End period must be on or after start period";

  if (input.mode === "FLAT") {
    if (input.flatPercent == null || input.flatPercent < 0 || input.flatPercent > 100) {
      return "Flat percent must be 0–100";
    }
  } else {
    if (input.splitBelowTarget == null || input.splitBelowTarget < 0 || input.splitBelowTarget > 100) {
      return "Below-target split must be 0–100";
    }
    if (input.splitAboveTarget == null || input.splitAboveTarget < 0 || input.splitAboveTarget > 100) {
      return "Above-target split must be 0–100";
    }
  }
  return null;
}

function periodsOverlap(
  a: { startMonth: number; startYear: number; endMonth: number | null; endYear: number | null },
  b: { startMonth: number; startYear: number; endMonth: number | null; endYear: number | null }
): boolean {
  const aStart = monthOrdinal(a.startMonth, a.startYear);
  const aEnd = a.endMonth && a.endYear ? monthOrdinal(a.endMonth, a.endYear) : Infinity;
  const bStart = monthOrdinal(b.startMonth, b.startYear);
  const bEnd = b.endMonth && b.endYear ? monthOrdinal(b.endMonth, b.endYear) : Infinity;
  return aStart <= bEnd && bStart <= aEnd;
}

async function closeOpenEndedRuleBefore(
  employeeId: string,
  startMonth: number,
  startYear: number,
  excludeId?: string
) {
  const openRule = await prisma.trainerSplitRule.findFirst({
    where: {
      employeeId,
      endMonth: null,
      endYear: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: [{ startYear: "desc" }, { startMonth: "desc" }],
  });

  if (!openRule) return;

  const newStart = monthOrdinal(startMonth, startYear);
  const openStart = monthOrdinal(openRule.startMonth, openRule.startYear);
  if (newStart <= openStart) return;

  const endOrdinal = newStart - 1;
  const endYear = Math.floor((endOrdinal - 1) / 12);
  const endMonth = ((endOrdinal - 1) % 12) + 1;

  await prisma.trainerSplitRule.update({
    where: { id: openRule.id },
    data: { endMonth, endYear },
  });
}

async function assertNoOverlap(
  employeeId: string,
  input: CreateSplitRuleInput,
  excludeId?: string
) {
  const existing = await prisma.trainerSplitRule.findMany({
    where: { employeeId, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  const period = {
    startMonth: input.startMonth,
    startYear: input.startYear,
    endMonth: input.endMonth ?? null,
    endYear: input.endYear ?? null,
  };
  for (const rule of existing) {
    if (periodsOverlap(period, rule)) {
      throw new Error(
        `Period overlaps existing rule (${rule.startMonth}/${rule.startYear}` +
          (rule.endMonth ? ` – ${rule.endMonth}/${rule.endYear}` : " – ongoing") +
          ")"
      );
    }
  }
}

export async function getLatestPaymentMonth(
  employeeId: string
): Promise<{ month: number; year: number } | null> {
  const payment = await prisma.payment.findFirst({
    where: { subscription: { client: { trainerId: employeeId } } },
    orderBy: [{ paidAt: "desc" }],
    select: { paidAt: true, collectedAt: true },
  });
  if (!payment) return null;
  const d = getPaymentCollectionDate(payment);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

export async function recalculateAffectedMonths(
  employeeId: string,
  fromMonth: number,
  fromYear: number,
  toMonth?: number,
  toYear?: number
): Promise<number> {
  const now = new Date();
  const defaultEnd = { month: now.getMonth() + 1, year: now.getFullYear() };
  const latest = await getLatestPaymentMonth(employeeId);

  let endMonth = toMonth ?? defaultEnd.month;
  let endYear = toYear ?? defaultEnd.year;
  if (latest) {
    const latestOrd = monthOrdinal(latest.month, latest.year);
    const endOrd = monthOrdinal(endMonth, endYear);
    if (latestOrd > endOrd) {
      endMonth = latest.month;
      endYear = latest.year;
    }
  }

  let count = 0;
  let m = fromMonth;
  let y = fromYear;
  while (monthOrdinal(m, y) <= monthOrdinal(endMonth, endYear)) {
    await recalculateTrainerMonthSplits(employeeId, m, y);
    count++;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return count;
}

export async function createSplitRule(
  employeeId: string,
  input: CreateSplitRuleInput,
  recalculate = true
): Promise<{ rule: SplitRuleDTO; monthsRecalculated: number }> {
  const err = validateRuleInput(input);
  if (err) throw new Error(err);
  await assertNoOverlap(employeeId, input);
  await closeOpenEndedRuleBefore(employeeId, input.startMonth, input.startYear);

  const rule = await prisma.trainerSplitRule.create({
    data: {
      employeeId,
      startMonth: input.startMonth,
      startYear: input.startYear,
      endMonth: input.endMonth ?? null,
      endYear: input.endYear ?? null,
      mode: input.mode,
      flatPercent: input.mode === "FLAT" ? input.flatPercent : null,
      monthlyTarget: input.mode === "TARGET_BASED" ? input.monthlyTarget : null,
      splitBelowTarget: input.mode === "TARGET_BASED" ? input.splitBelowTarget : null,
      splitAboveTarget: input.mode === "TARGET_BASED" ? input.splitAboveTarget : null,
      notes: input.notes ?? null,
    },
  });

  const monthsRecalculated = recalculate
    ? await recalculateAffectedMonths(employeeId, input.startMonth, input.startYear)
    : 0;

  return { rule: ruleToDto(rule), monthsRecalculated };
}

export async function updateSplitRule(
  ruleId: string,
  input: Partial<CreateSplitRuleInput>,
  recalculate = true
): Promise<{ rule: SplitRuleDTO; monthsRecalculated: number }> {
  const existing = await prisma.trainerSplitRule.findUnique({ where: { id: ruleId } });
  if (!existing) throw new Error("Rule not found");

  const merged: CreateSplitRuleInput = {
    startMonth: input.startMonth ?? existing.startMonth,
    startYear: input.startYear ?? existing.startYear,
    endMonth: input.endMonth !== undefined ? input.endMonth : existing.endMonth,
    endYear: input.endYear !== undefined ? input.endYear : existing.endYear,
    mode: input.mode ?? existing.mode,
    flatPercent:
      input.flatPercent !== undefined
        ? input.flatPercent
        : existing.flatPercent !== null
          ? decimalToNumber(existing.flatPercent)
          : null,
    monthlyTarget:
      input.monthlyTarget !== undefined
        ? input.monthlyTarget
        : existing.monthlyTarget !== null
          ? decimalToNumber(existing.monthlyTarget)
          : null,
    splitBelowTarget:
      input.splitBelowTarget !== undefined
        ? input.splitBelowTarget
        : existing.splitBelowTarget !== null
          ? decimalToNumber(existing.splitBelowTarget)
          : null,
    splitAboveTarget:
      input.splitAboveTarget !== undefined
        ? input.splitAboveTarget
        : existing.splitAboveTarget !== null
          ? decimalToNumber(existing.splitAboveTarget)
          : null,
    notes: input.notes !== undefined ? input.notes : existing.notes,
  };

  const err = validateRuleInput(merged);
  if (err) throw new Error(err);
  await assertNoOverlap(existing.employeeId, merged, ruleId);

  const rule = await prisma.trainerSplitRule.update({
    where: { id: ruleId },
    data: {
      startMonth: merged.startMonth,
      startYear: merged.startYear,
      endMonth: merged.endMonth ?? null,
      endYear: merged.endYear ?? null,
      mode: merged.mode,
      flatPercent: merged.mode === "FLAT" ? merged.flatPercent : null,
      monthlyTarget: merged.mode === "TARGET_BASED" ? merged.monthlyTarget : null,
      splitBelowTarget: merged.mode === "TARGET_BASED" ? merged.splitBelowTarget : null,
      splitAboveTarget: merged.mode === "TARGET_BASED" ? merged.splitAboveTarget : null,
      notes: merged.notes ?? null,
    },
  });

  const fromOrd = Math.min(
    monthOrdinal(existing.startMonth, existing.startYear),
    monthOrdinal(merged.startMonth, merged.startYear)
  );
  const fromYear = Math.floor((fromOrd - 1) / 12);
  const fromMonth = ((fromOrd - 1) % 12) + 1;

  const monthsRecalculated = recalculate
    ? await recalculateAffectedMonths(existing.employeeId, fromMonth, fromYear)
    : 0;

  return { rule: ruleToDto(rule), monthsRecalculated };
}

export async function deleteSplitRule(
  ruleId: string,
  recalculate = true
): Promise<{ monthsRecalculated: number }> {
  const existing = await prisma.trainerSplitRule.findUnique({ where: { id: ruleId } });
  if (!existing) throw new Error("Rule not found");

  await prisma.trainerSplitRule.delete({ where: { id: ruleId } });

  const monthsRecalculated = recalculate
    ? await recalculateAffectedMonths(
        existing.employeeId,
        existing.startMonth,
        existing.startYear
      )
    : 0;

  return { monthsRecalculated };
}

export async function upsertSplitRulesForTrainer(
  employeeId: string,
  rules: CreateSplitRuleInput[]
) {
  await prisma.trainerSplitRule.deleteMany({ where: { employeeId } });
  for (const input of rules.sort(
    (a, b) => monthOrdinal(a.startMonth, a.startYear) - monthOrdinal(b.startMonth, b.startYear)
  )) {
    await prisma.trainerSplitRule.create({
      data: {
        employeeId,
        startMonth: input.startMonth,
        startYear: input.startYear,
        endMonth: input.endMonth ?? null,
        endYear: input.endYear ?? null,
        mode: input.mode,
        flatPercent: input.mode === "FLAT" ? input.flatPercent : null,
        monthlyTarget: input.mode === "TARGET_BASED" ? input.monthlyTarget : null,
        splitBelowTarget: input.mode === "TARGET_BASED" ? input.splitBelowTarget : null,
        splitAboveTarget: input.mode === "TARGET_BASED" ? input.splitAboveTarget : null,
        notes: input.notes ?? null,
      },
    });
  }
}
