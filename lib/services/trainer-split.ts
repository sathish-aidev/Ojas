import { prisma } from "@/lib/prisma";
import { computeRevenueSplit } from "@/lib/permissions";
import { decimalToNumber } from "@/lib/utils";
import type { SplitRuleMode, TrainerSplitRule } from "@prisma/client";

export type TrainerSplitConfig = {
  monthlyTarget: number | null;
  revenueSplitBelowTarget: number;
  revenueSplitAboveTarget: number;
  targetSplitAppliesFrom: Date | null;
};

export type SplitResolution = {
  splitPercent: number;
  mode: SplitRuleMode | "LEGACY";
  hasTarget: boolean;
  targetMet: boolean;
  flatSplitPeriod: boolean;
  monthlyTarget: number | null;
  splitBelow: number;
  splitAbove: number;
};

function monthOrdinal(month: number, year: number): number {
  return year * 12 + month;
}

function ruleAppliesToMonth(rule: TrainerSplitRule, month: number, year: number): boolean {
  const target = monthOrdinal(month, year);
  const start = monthOrdinal(rule.startMonth, rule.startYear);
  if (target < start) return false;
  if (rule.endMonth === null || rule.endYear === null) return true;
  return target <= monthOrdinal(rule.endMonth, rule.endYear);
}

export async function getSplitRuleForMonth(
  employeeId: string,
  month: number,
  year: number
): Promise<TrainerSplitRule | null> {
  const rules = await prisma.trainerSplitRule.findMany({
    where: { employeeId },
    orderBy: [{ startYear: "desc" }, { startMonth: "desc" }],
  });
  return rules.find((r) => ruleAppliesToMonth(r, month, year)) ?? null;
}

export function getMonthBounds(month: number, year: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

export function getPaymentCollectionDate(payment: {
  collectedAt: Date | null;
  paidAt: Date;
}): Date {
  return payment.collectedAt ?? payment.paidAt;
}

export function paymentsCollectedInMonthWhere(month: number, year: number) {
  const { start, end } = getMonthBounds(month, year);
  return {
    OR: [
      { collectedAt: { gte: start, lte: end } },
      { collectedAt: null, paidAt: { gte: start, lte: end } },
    ],
  };
}

export function paymentsWithServiceMonthWhere(month: number, year: number) {
  const { start, end } = getMonthBounds(month, year);
  return { paidAt: { gte: start, lte: end } };
}

export function parseTrainerSplitConfig(trainer: {
  monthlyTarget: { toString(): string } | null;
  revenueSplitBelowTarget: { toString(): string } | null;
  revenueSplitAboveTarget: { toString(): string } | null;
  targetSplitAppliesFrom?: Date | null;
}): TrainerSplitConfig {
  return {
    monthlyTarget:
      trainer.monthlyTarget && decimalToNumber(trainer.monthlyTarget) > 0
        ? decimalToNumber(trainer.monthlyTarget)
        : null,
    revenueSplitBelowTarget: decimalToNumber(trainer.revenueSplitBelowTarget) || 50,
    revenueSplitAboveTarget: decimalToNumber(trainer.revenueSplitAboveTarget) || 50,
    targetSplitAppliesFrom: trainer.targetSplitAppliesFrom ?? null,
  };
}

export function usesTargetBasedSplit(
  config: TrainerSplitConfig,
  month: number,
  year: number
): boolean {
  if (!config.targetSplitAppliesFrom) return true;
  const fromMonth = config.targetSplitAppliesFrom.getMonth() + 1;
  const fromYear = config.targetSplitAppliesFrom.getFullYear();
  return year > fromYear || (year === fromYear && month >= fromMonth);
}

export function getEffectiveSplitPercent(
  config: TrainerSplitConfig,
  monthlyPtRevenue: number,
  month?: number,
  year?: number
): number {
  const { monthlyTarget, revenueSplitBelowTarget, revenueSplitAboveTarget } = config;

  if (
    month !== undefined &&
    year !== undefined &&
    !usesTargetBasedSplit(config, month, year)
  ) {
    return revenueSplitBelowTarget;
  }

  if (!monthlyTarget || monthlyTarget <= 0) {
    return revenueSplitBelowTarget;
  }
  return monthlyPtRevenue >= monthlyTarget
    ? revenueSplitAboveTarget
    : revenueSplitBelowTarget;
}

export async function resolveSplitForMonth(
  employeeId: string,
  month: number,
  year: number,
  collectionRevenue: number
): Promise<SplitResolution> {
  const rule = await getSplitRuleForMonth(employeeId, month, year);

  if (rule) {
    if (rule.mode === "FLAT") {
      const flat = decimalToNumber(rule.flatPercent) || 50;
      return {
        splitPercent: flat,
        mode: "FLAT",
        hasTarget: false,
        targetMet: false,
        flatSplitPeriod: true,
        monthlyTarget: null,
        splitBelow: flat,
        splitAbove: flat,
      };
    }

    const monthlyTarget =
      rule.monthlyTarget !== null ? decimalToNumber(rule.monthlyTarget) : null;
    const splitBelow = decimalToNumber(rule.splitBelowTarget) || 50;
    const splitAbove = decimalToNumber(rule.splitAboveTarget) || splitBelow;
    const hasTarget = !!(monthlyTarget && monthlyTarget > 0);
    const targetMet = hasTarget && collectionRevenue >= monthlyTarget!;
    const splitPercent = hasTarget
      ? targetMet
        ? splitAbove
        : splitBelow
      : splitBelow;

    return {
      splitPercent,
      mode: "TARGET_BASED",
      hasTarget,
      targetMet,
      flatSplitPeriod: false,
      monthlyTarget,
      splitBelow,
      splitAbove,
    };
  }

  const trainer = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!trainer) {
    return {
      splitPercent: 50,
      mode: "LEGACY",
      hasTarget: false,
      targetMet: false,
      flatSplitPeriod: false,
      monthlyTarget: null,
      splitBelow: 50,
      splitAbove: 50,
    };
  }

  const config = parseTrainerSplitConfig(trainer);
  const flatSplitPeriod = !usesTargetBasedSplit(config, month, year);
  const hasTarget = !!(config.monthlyTarget && config.monthlyTarget > 0) && !flatSplitPeriod;
  const targetMet = hasTarget && collectionRevenue >= config.monthlyTarget!;
  const splitPercent = getEffectiveSplitPercent(config, collectionRevenue, month, year);

  return {
    splitPercent,
    mode: "LEGACY",
    hasTarget,
    targetMet,
    flatSplitPeriod,
    monthlyTarget: config.monthlyTarget,
    splitBelow: config.revenueSplitBelowTarget,
    splitAbove: config.revenueSplitAboveTarget,
  };
}

export async function getTrainerMonthlyPtRevenue(
  trainerId: string,
  month: number,
  year: number
): Promise<number> {
  const payments = await prisma.payment.findMany({
    where: {
      ...paymentsCollectedInMonthWhere(month, year),
      subscription: { client: { trainerId } },
    },
    select: { amount: true },
  });
  return payments.reduce((sum, p) => sum + decimalToNumber(p.amount), 0);
}

export async function recalculateTrainerMonthSplits(
  trainerId: string,
  month: number,
  year: number
) {
  const collectionRevenue = await getTrainerMonthlyPtRevenue(trainerId, month, year);
  const resolution = await resolveSplitForMonth(trainerId, month, year, collectionRevenue);
  const { splitPercent } = resolution;

  const servicePayments = await prisma.payment.findMany({
    where: {
      ...paymentsWithServiceMonthWhere(month, year),
      subscription: { client: { trainerId } },
    },
  });

  if (servicePayments.length === 0) {
    return {
      monthlyRevenue: collectionRevenue,
      splitPercent,
      targetMet: resolution.targetMet,
    };
  }

  await prisma.$transaction(
    servicePayments.map((payment) => {
      const amount = decimalToNumber(payment.amount);
      const { trainerShare, ownerShare } = computeRevenueSplit(amount, splitPercent);
      return prisma.payment.update({
        where: { id: payment.id },
        data: {
          trainerShareAmount: trainerShare,
          ownerShareAmount: ownerShare,
          splitPercentUsed: splitPercent,
        },
      });
    })
  );

  return {
    monthlyRevenue: collectionRevenue,
    splitPercent,
    targetMet: resolution.targetMet,
  };
}

export function getSplitStatusFromResolution(resolution: SplitResolution): {
  activeSplit: number;
  targetMet: boolean;
  hasTarget: boolean;
  flatSplitPeriod: boolean;
} {
  return {
    activeSplit: resolution.splitPercent,
    targetMet: resolution.targetMet,
    hasTarget: resolution.hasTarget,
    flatSplitPeriod: resolution.flatSplitPeriod,
  };
}

/** @deprecated Use resolveSplitForMonth + getSplitStatusFromResolution */
export function getSplitStatusLabel(
  config: TrainerSplitConfig,
  monthlyRevenue: number,
  month: number,
  year: number
): {
  activeSplit: number;
  targetMet: boolean;
  hasTarget: boolean;
  flatSplitPeriod: boolean;
} {
  const flatSplitPeriod = !usesTargetBasedSplit(config, month, year);
  const hasTarget = !!(config.monthlyTarget && config.monthlyTarget > 0) && !flatSplitPeriod;
  const targetMet = hasTarget && monthlyRevenue >= config.monthlyTarget!;
  const activeSplit = getEffectiveSplitPercent(config, monthlyRevenue, month, year);
  return { activeSplit, targetMet, hasTarget, flatSplitPeriod };
}

export async function getSplitStatusForMonth(
  employeeId: string,
  month: number,
  year: number,
  collectionRevenue?: number
) {
  const revenue =
    collectionRevenue ?? (await getTrainerMonthlyPtRevenue(employeeId, month, year));
  const resolution = await resolveSplitForMonth(employeeId, month, year, revenue);
  return getSplitStatusFromResolution(resolution);
}
