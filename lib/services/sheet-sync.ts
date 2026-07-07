import { prisma } from "@/lib/prisma";
import { fetchSheetTab } from "@/lib/google/sheets-client";
import { parseGymSheetRows } from "@/lib/import/parse-gym-sheet";
import type { ParsedGymRow } from "@/lib/import/parse-gym-csv";
import { allocateMonthlyInstallments } from "@/lib/services/payment-allocation";
import { upsertSubscriptionWithPayment } from "@/lib/services/pt-tracker";
import { recalculateTrainerMonthSplits } from "@/lib/services/trainer-split";
import { TRAINER_SHEET_TABS } from "@/lib/sheet-config";

export type TabSyncResult = {
  tabName: string;
  trainerName: string;
  rowsParsed: number;
  created: number;
  updated: number;
  skipped: number;
  warnings: string[];
  errors: string[];
};

export type SheetSyncSummary = {
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  tabs: TabSyncResult[];
  totalCreated: number;
  totalUpdated: number;
  totalErrors: number;
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}`;
}

async function findTrainerByTabName(gymId: string, tabName: string) {
  return prisma.employee.findFirst({
    where: {
      gymId,
      employeeType: "TRAINER",
      user: { name: { equals: tabName, mode: "insensitive" } },
    },
    include: { user: true },
  });
}

async function findOrCreateClient(gymId: string, trainerId: string, name: string) {
  const trimmed = name.trim();
  let client = await prisma.client.findFirst({
    where: { gymId, trainerId, name: trimmed },
  });
  if (!client) {
    client = await prisma.client.create({
      data: { gymId, trainerId, name: trimmed, status: "ACTIVE" },
    });
  }
  return client;
}

export async function syncTrainerTab(
  gymId: string,
  tabName: string,
  rawRows?: string[][]
): Promise<TabSyncResult> {
  const result: TabSyncResult = {
    tabName,
    trainerName: tabName,
    rowsParsed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    warnings: [],
    errors: [],
  };

  const trainer = await findTrainerByTabName(gymId, tabName);
  if (!trainer) {
    result.errors.push(`Trainer "${tabName}" not found in app`);
    return result;
  }
  result.trainerName = trainer.user.name;

  const rows = rawRows ?? (await fetchSheetTab(tabName));
  const parsed = parseGymSheetRows(rows);

  if (parsed.errors.length > 0) {
    for (const e of parsed.errors) {
      result.errors.push(`Row ${e.rowNumber}: ${e.message}`);
    }
    return result;
  }

  const sortedRows = [...parsed.rows].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime()
  );
  result.rowsParsed = sortedRows.length;

  for (const row of sortedRows) {
    for (const w of row.warnings) {
      result.warnings.push(`Row ${row.rowNumber} [${row.customer}]: ${w}`);
    }
  }

  const touchedMonths = new Set<string>();

  for (const row of sortedRows) {
    try {
      const client = await findOrCreateClient(gymId, trainer.id, row.customer);
      const action = await upsertSubscriptionWithPayment({
        clientId: client.id,
        amount: row.amount,
        paymentDate: row.paymentDate,
        startDate: row.startDate,
        endDate: row.endDate,
        monthsCount: row.monthsCount,
        paymentMode: row.paymentMode,
        notes: row.paymentNotes || undefined,
      });
      if (action === "created") result.created++;
      else result.updated++;

      touchedMonths.add(monthKey(row.paymentDate));
      const inst = allocateMonthlyInstallments(row.amount, row.startDate, row.monthsCount);
      for (const i of inst) touchedMonths.add(monthKey(i.serviceDate));
    } catch (err) {
      result.errors.push(
        `Row ${row.rowNumber} [${row.customer}]: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  for (const key of [...touchedMonths].sort()) {
    const [year, month] = key.split("-").map(Number);
    await recalculateTrainerMonthSplits(trainer.id, month, year);
  }

  return result;
}

export async function syncAllTrainerTabs(
  gymId: string,
  options?: {
    triggeredBy?: string;
    source?: "MANUAL" | "CRON";
    month?: number;
    year?: number;
    tabs?: string[];
  }
): Promise<{ syncRunId: string; summary: SheetSyncSummary }> {
  const tabs = options?.tabs ?? [...TRAINER_SHEET_TABS];
  const tabResults: TabSyncResult[] = [];
  const snapshots: Array<{
    tabName: string;
    rawRows: string[][];
    parsedRows: ParsedGymRow[];
  }> = [];

  for (const tabName of tabs) {
    let rawRows: string[][] = [];
    try {
      rawRows = await fetchSheetTab(tabName);
      const parsed = parseGymSheetRows(rawRows);
      snapshots.push({
        tabName,
        rawRows,
        parsedRows: parsed.rows,
      });
      const tabResult = await syncTrainerTab(gymId, tabName, rawRows);
      tabResults.push(tabResult);
    } catch (err) {
      tabResults.push({
        tabName,
        trainerName: tabName,
        rowsParsed: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        warnings: [],
        errors: [err instanceof Error ? err.message : "Failed to fetch tab"],
      });
    }
  }

  const totalErrors = tabResults.reduce((s, t) => s + t.errors.length, 0);
  const totalCreated = tabResults.reduce((s, t) => s + t.created, 0);
  const totalUpdated = tabResults.reduce((s, t) => s + t.updated, 0);

  const summary: SheetSyncSummary = {
    status:
      totalErrors > 0 && totalCreated + totalUpdated === 0
        ? "FAILED"
        : totalErrors > 0
          ? "PARTIAL"
          : "SUCCESS",
    tabs: tabResults,
    totalCreated,
    totalUpdated,
    totalErrors,
  };

  const syncRun = await prisma.sheetSyncRun.create({
    data: {
      gymId,
      triggeredBy: options?.triggeredBy ?? null,
      source: options?.source ?? "MANUAL",
      status: summary.status,
      month: options?.month ?? null,
      year: options?.year ?? null,
      summary: summary as object,
      snapshots: {
        create: snapshots.map((s) => ({
          tabName: s.tabName,
          rawRows: s.rawRows as object,
          parsedRows: s.parsedRows.map((r) => ({
            ...r,
            startDate: r.startDate.toISOString(),
            endDate: r.endDate.toISOString(),
            paymentDate: r.paymentDate.toISOString(),
          })) as object,
        })),
      },
    },
  });

  await pruneOldSnapshots(gymId, 12);

  return { syncRunId: syncRun.id, summary };
}

async function pruneOldSnapshots(gymId: string, keep: number) {
  const runs = await prisma.sheetSyncRun.findMany({
    where: { gymId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
    skip: keep,
  });
  if (runs.length === 0) return;
  await prisma.sheetSyncRun.deleteMany({
    where: { id: { in: runs.map((r) => r.id) } },
  });
}

export async function getSheetSyncRuns(gymId: string, limit = 20) {
  return prisma.sheetSyncRun.findMany({
    where: { gymId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { snapshots: { select: { id: true, tabName: true } } },
  });
}

export async function restoreSheetSyncRun(syncRunId: string, gymId: string) {
  const run = await prisma.sheetSyncRun.findFirst({
    where: { id: syncRunId, gymId },
    include: { snapshots: true },
  });
  if (!run) throw new Error("Sync run not found");

  const tabResults: TabSyncResult[] = [];
  for (const snap of run.snapshots) {
    const rawRows = snap.rawRows as string[][];
    const tabResult = await syncTrainerTab(gymId, snap.tabName, rawRows);
    tabResults.push(tabResult);
  }

  const totalErrors = tabResults.reduce((s, t) => s + t.errors.length, 0);
  return {
    status: totalErrors > 0 ? "PARTIAL" : "SUCCESS",
    tabs: tabResults,
    restoredFrom: run.id,
    restoredAt: run.createdAt,
  };
}
