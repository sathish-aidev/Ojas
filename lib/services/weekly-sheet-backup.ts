import { prisma } from "@/lib/prisma";
import { fetchSheetTab } from "@/lib/google/sheets-client";
import { backupPtTrackerSpreadsheet } from "@/lib/google/drive-archive";
import { TRAINER_SHEET_TABS } from "@/lib/sheet-config";
import { parseGymSheetRows } from "@/lib/import/parse-gym-sheet";

export async function runWeeklySheetBackup(gymId: string, triggeredBy = "cron") {
  const snapshots: Array<{
    tabName: string;
    rawRows: string[][];
    parsedRows: object;
  }> = [];

  for (const tabName of TRAINER_SHEET_TABS) {
    const rawRows = await fetchSheetTab(tabName);
    const parsed = parseGymSheetRows(rawRows);
    snapshots.push({
      tabName,
      rawRows,
      parsedRows: parsed.rows.map((r) => ({
        ...r,
        startDate: r.startDate.toISOString(),
        endDate: r.endDate.toISOString(),
        paymentDate: r.paymentDate.toISOString(),
      })),
    });
  }

  let folderName = "";
  let folderUrl = "";
  let fileUrl: string | null = null;
  let method: "drive_copy" | "xlsx_export" | "sheet_tabs" | "db_only" = "db_only";
  let tabNames: string[] | undefined;
  let driveError: string | null = null;
  let status: "SUCCESS" | "PARTIAL" = "SUCCESS";

  try {
    const driveResult = await backupPtTrackerSpreadsheet();
    method = driveResult.method;
    folderName = driveResult.folderName ?? "";
    folderUrl = driveResult.folderUrl ?? "";
    fileUrl = driveResult.fileUrl ?? driveResult.spreadsheetUrl ?? null;
    tabNames = driveResult.tabNames;
  } catch (err) {
    driveError = err instanceof Error ? err.message : String(err);
    status = "PARTIAL";
  }

  await prisma.sheetSyncRun.create({
    data: {
      gymId,
      triggeredBy,
      source: "BACKUP",
      status,
      summary: {
        type: "weekly_backup",
        method,
        folderName,
        folderUrl,
        fileUrl,
        tabNames,
        driveError,
        tabRowCounts: snapshots.map((s) => ({
          tab: s.tabName,
          rows: s.rawRows.length,
        })),
      },
      snapshots: {
        create: snapshots.map((s) => ({
          tabName: s.tabName,
          rawRows: s.rawRows as object,
          parsedRows: s.parsedRows as object,
        })),
      },
    },
  });

  return {
    status,
    method,
    folderName,
    folderUrl,
    fileUrl,
    tabNames,
    driveError,
    dbSnapshot: true,
  };
}
