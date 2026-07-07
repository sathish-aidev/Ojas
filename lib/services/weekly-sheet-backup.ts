import { prisma } from "@/lib/prisma";
import { fetchSheetTab } from "@/lib/google/sheets-client";
import {
  copySpreadsheetWeeklyBackup,
  ensureWeeklyBackupFolder,
  getMonthFolderWebLink,
} from "@/lib/google/drive-archive";
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

  try {
    const folder = await ensureWeeklyBackupFolder();
    folderName = folder.folderName;
    folderUrl = getMonthFolderWebLink(folder.folderId);
    fileUrl = await copySpreadsheetWeeklyBackup(folder.folderId);
  } catch {
    // Drive copy may fail on service-account quota; DB snapshot still protects data
  }

  await prisma.sheetSyncRun.create({
    data: {
      gymId,
      triggeredBy,
      source: "BACKUP",
      status: "SUCCESS",
      summary: {
        type: "weekly_backup",
        folderName,
        folderUrl,
        fileUrl,
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
    folderName,
    folderUrl,
    fileUrl,
    dbSnapshot: true,
  };
}
