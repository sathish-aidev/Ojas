import { google } from "googleapis";
import { Readable } from "stream";
import { getGoogleAuth, ALL_GOOGLE_SCOPES } from "./google-auth";
import { getSheetsClient } from "./sheets-client";
import {
  getDriveFolderId,
  getSpreadsheetId,
  getBackupSpreadsheetId,
  PT_SPREADSHEET_NAME,
  REPORTS_FOLDER_NAME,
  WEEKLY_BACKUPS_FOLDER,
  TRAINER_SHEET_TABS,
  BACKUP_TAB_PREFIX,
} from "@/lib/sheet-config";
import { getMonthName } from "@/lib/permissions";
import { getOwnerReportEmail } from "@/lib/sheet-config";

async function transferFileToOwner(drive: Awaited<ReturnType<typeof getDriveClient>>, fileId: string) {
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        type: "user",
        role: "owner",
        emailAddress: getOwnerReportEmail(),
      },
      transferOwnership: true,
      supportsAllDrives: true,
    });
  } catch {
    // Non-fatal — backup may still be readable via shared folder
  }
}

async function getDriveClient() {
  const auth = getGoogleAuth(ALL_GOOGLE_SCOPES);
  return google.drive({ version: "v3", auth });
}

function driveListOpts(q: string) {
  return {
    q,
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  } as const;
}

async function findChildFolder(
  parentId: string,
  name: string
): Promise<string | null> {
  const drive = await getDriveClient();
  const q = `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await drive.files.list(driveListOpts(q));
  return res.data.files?.[0]?.id ?? null;
}

async function createFolder(parentId: string, name: string): Promise<string> {
  const drive = await getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!res.data.id) throw new Error(`Failed to create folder: ${name}`);
  return res.data.id;
}

export async function ensureFolder(parentId: string, name: string): Promise<string> {
  const existing = await findChildFolder(parentId, name);
  if (existing) return existing;
  return createFolder(parentId, name);
}

export async function ensureReportsMonthFolder(
  month: number,
  year: number
): Promise<{ folderId: string; folderName: string }> {
  const rootId = getDriveFolderId();
  const reportsId = await ensureFolder(rootId, REPORTS_FOLDER_NAME);
  const folderName = `${year}-${String(month).padStart(2, "0")}`;
  const folderId = await ensureFolder(reportsId, folderName);
  return { folderId, folderName };
}

export async function findSpreadsheetByName(
  name: string = PT_SPREADSHEET_NAME
): Promise<string | null> {
  const drive = await getDriveClient();
  const folderId = getDriveFolderId();
  const q = `'${folderId}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const res = await drive.files.list(driveListOpts(q));
  return res.data.files?.[0]?.id ?? null;
}

export async function createPtTrackerSpreadsheet(): Promise<string> {
  const drive = await getDriveClient();
  const folderId = getDriveFolderId();
  const res = await drive.files.create({
    requestBody: {
      name: PT_SPREADSHEET_NAME,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [folderId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!res.data.id) throw new Error("Failed to create PT tracker spreadsheet");
  return res.data.id;
}

export async function copySpreadsheetBackup(
  month: number,
  year: number,
  destFolderId: string
): Promise<string> {
  const drive = await getDriveClient();
  const spreadsheetId = getSpreadsheetId();
  const monthLabel = `${getMonthName(month)}-${year}`;
  const res = await drive.files.copy({
    fileId: spreadsheetId,
    requestBody: {
      name: `PT-Sheet-Backup-${monthLabel}`,
      parents: [destFolderId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!res.data.id) throw new Error("Failed to copy spreadsheet backup");
  await transferFileToOwner(drive, res.data.id);
  return res.data.id;
}

export async function uploadPdfToFolder(
  folderId: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  const drive = await getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType: "application/pdf",
      body: Readable.from(buffer),
    },
    fields: "id,webViewLink",
    supportsAllDrives: true,
  });
  if (!res.data.id) throw new Error(`Failed to upload ${filename}`);
  return res.data.webViewLink ?? `https://drive.google.com/file/d/${res.data.id}/view`;
}

export function getMonthFolderWebLink(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

function formatBackupDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function ensureWeeklyBackupFolder(date = new Date()): Promise<{
  folderId: string;
  folderName: string;
}> {
  const rootId = getDriveFolderId();
  const backupsId = await ensureFolder(rootId, WEEKLY_BACKUPS_FOLDER);
  const folderName = formatBackupDate(date);
  const folderId = await ensureFolder(backupsId, folderName);
  return { folderId, folderName };
}

export async function copySpreadsheetWeeklyBackup(
  destFolderId: string,
  date = new Date()
): Promise<string> {
  const drive = await getDriveClient();
  const spreadsheetId = getSpreadsheetId();
  const label = formatBackupDate(date);
  const res = await drive.files.copy({
    fileId: spreadsheetId,
    requestBody: {
      name: `Impackt-Fitness-PT-Tracker-Backup-${label}`,
      parents: [destFolderId],
    },
    fields: "id,webViewLink",
    supportsAllDrives: true,
  });
  if (!res.data.id) throw new Error("Failed to copy weekly spreadsheet backup");
  await transferFileToOwner(drive, res.data.id);
  return res.data.webViewLink ?? `https://drive.google.com/file/d/${res.data.id}/view`;
}

function backupTabTitle(label: string, tabName: string): string {
  return `${BACKUP_TAB_PREFIX}${label} ${tabName}`.slice(0, 100);
}

/**
 * Copy trainer tabs into a spreadsheet the user already owns.
 * Works when Drive files.copy fails (service accounts have no storage quota).
 */
export async function backupTrainerTabsInSpreadsheet(
  date = new Date()
): Promise<{ spreadsheetId: string; tabNames: string[]; spreadsheetUrl: string }> {
  const sourceId = getSpreadsheetId();
  const destId = getBackupSpreadsheetId() ?? sourceId;
  const label = formatBackupDate(date);
  const sheets = await getSheetsClient();

  const [sourceMeta, destMeta] = await Promise.all([
    sheets.spreadsheets.get({
      spreadsheetId: sourceId,
      fields: "sheets.properties(sheetId,title)",
    }),
    destId === sourceId
      ? Promise.resolve(null)
      : sheets.spreadsheets.get({
          spreadsheetId: destId,
          fields: "sheets.properties(sheetId,title)",
        }),
  ]);

  const destSheets =
    destId === sourceId ? sourceMeta.data.sheets : destMeta?.data.sheets;
  const existingTitles = new Set(
    destSheets?.map((s) => s.properties?.title).filter((t): t is string => !!t) ??
      []
  );

  const created: string[] = [];

  for (const tabName of TRAINER_SHEET_TABS) {
    const sourceSheet = sourceMeta.data.sheets?.find(
      (s) => s.properties?.title === tabName
    );
    const sheetId = sourceSheet?.properties?.sheetId;
    if (sheetId == null) continue;

    const title = backupTabTitle(label, tabName);
    const prior = destSheets?.find((s) => s.properties?.title === title);
    if (prior?.properties?.sheetId != null) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: destId,
        requestBody: {
          requests: [{ deleteSheet: { sheetId: prior.properties.sheetId } }],
        },
      });
      existingTitles.delete(title);
    }

    const copied = await sheets.spreadsheets.sheets.copyTo({
      spreadsheetId: sourceId,
      sheetId,
      requestBody: { destinationSpreadsheetId: destId },
    });
    const newSheetId = copied.data.sheetId;
    if (newSheetId == null) {
      throw new Error(`Failed to copy sheet tab "${tabName}" into backup spreadsheet`);
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: destId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: newSheetId,
                title,
                hidden: destId === sourceId,
              },
              fields: "title,hidden",
            },
          },
        ],
      },
    });
    created.push(title);
  }

  if (created.length === 0) {
    throw new Error("No trainer tabs found to back up in the PT tracker spreadsheet");
  }

  await pruneOldBackupTabs(destId, 56);

  return {
    spreadsheetId: destId,
    tabNames: created,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${destId}`,
  };
}

/** Delete Backup YYYY-MM-DD … tabs older than keepDays. */
async function pruneOldBackupTabs(spreadsheetId: string, keepDays: number) {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  const toDelete: number[] = [];

  for (const sheet of meta.data.sheets ?? []) {
    const title = sheet.properties?.title;
    const sheetId = sheet.properties?.sheetId;
    if (!title || sheetId == null || !title.startsWith(BACKUP_TAB_PREFIX)) continue;
    const match = title.slice(BACKUP_TAB_PREFIX.length).match(/^(\d{4}-\d{2}-\d{2})\b/);
    if (!match) continue;
    const ts = Date.parse(match[1]);
    if (!Number.isNaN(ts) && ts < cutoff) toDelete.push(sheetId);
  }

  if (toDelete.length === 0) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: toDelete.map((sheetId) => ({ deleteSheet: { sheetId } })),
    },
  });
}

export type SheetFileBackupResult = {
  method: "drive_copy" | "sheet_tabs";
  folderName?: string;
  folderUrl?: string;
  fileUrl?: string | null;
  spreadsheetUrl?: string;
  tabNames?: string[];
};

/**
 * Prefer a full Drive file copy into Backups/YYYY-MM-DD.
 * Fall back to copying trainer tabs inside a user-owned spreadsheet (SA-safe).
 */
export async function backupPtTrackerSpreadsheet(
  date = new Date()
): Promise<SheetFileBackupResult> {
  const errors: string[] = [];

  try {
    const folder = await ensureWeeklyBackupFolder(date);
    const fileUrl = await copySpreadsheetWeeklyBackup(folder.folderId, date);
    return {
      method: "drive_copy",
      folderName: folder.folderName,
      folderUrl: getMonthFolderWebLink(folder.folderId),
      fileUrl,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  try {
    const tabs = await backupTrainerTabsInSpreadsheet(date);
    return {
      method: "sheet_tabs",
      folderName: formatBackupDate(date),
      fileUrl: tabs.spreadsheetUrl,
      spreadsheetUrl: tabs.spreadsheetUrl,
      tabNames: tabs.tabNames,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    throw new Error(`Sheet backup failed: ${errors.join(" | ")}`);
  }
}
