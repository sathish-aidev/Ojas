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
  EXPENSES_TAB_NAME,
  CULT_INVOICES_FOLDER,
  CULT_SETTLEMENT_FOLDER,
  CULT_TAX_INVOICE_FOLDER,
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

export async function getDriveClient() {
  const auth = getGoogleAuth(ALL_GOOGLE_SCOPES);
  return google.drive({ version: "v3", auth });
}

export type DriveFileMeta = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string | null;
  modifiedTime: string | null;
};

function toDriveFileMeta(file: {
  id?: string | null;
  name?: string | null;
  mimeType?: string | null;
  webViewLink?: string | null;
  modifiedTime?: string | null;
}): DriveFileMeta | null {
  if (!file.id || !file.name) return null;
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType ?? "application/octet-stream",
    webViewLink: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
    modifiedTime: file.modifiedTime ?? null,
  };
}

export async function listDriveChildren(folderId: string): Promise<DriveFileMeta[]> {
  const drive = await getDriveClient();
  const files: DriveFileMeta[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime)",
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const file of res.data.files ?? []) {
      const meta = toDriveFileMeta(file);
      if (meta) files.push(meta);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return files;
}

export async function searchDrivePdfsByName(terms: string[]): Promise<DriveFileMeta[]> {
  const drive = await getDriveClient();
  const nameQuery = terms.map((term) => `name contains '${term.replace(/'/g, "\\'")}'`).join(" or ");
  const q = `(${nameQuery}) and trashed=false`;
  const files: DriveFileMeta[] = [];
  let pageToken: string | undefined;
  const listOpts = {
    q,
    fields: "nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime)",
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  } as const;

  const first = await drive.files.list({
    ...listOpts,
    corpora: "allDrives",
  }).catch(() => drive.files.list(listOpts));

  const collect = (res: typeof first) => {
    for (const file of res.data.files ?? []) {
      const meta = toDriveFileMeta(file);
      if (meta) files.push(meta);
    }
    return res.data.nextPageToken ?? undefined;
  };

  pageToken = collect(first);
  while (pageToken) {
    const res = await drive.files.list({ ...listOpts, pageToken }).catch(async () => {
      return drive.files.list({ ...listOpts, pageToken, corpora: undefined });
    });
    pageToken = collect(res);
  }
  return files;
}

export async function downloadDriveFileBuffer(fileId: string): Promise<Buffer> {
  const drive = await getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
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

export async function uploadFileToFolder(
  folderId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const drive = await getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id,webViewLink",
    supportsAllDrives: true,
  });
  if (!res.data.id) throw new Error(`Failed to upload ${filename}`);
  await transferFileToOwner(drive, res.data.id);
  return res.data.webViewLink ?? `https://drive.google.com/file/d/${res.data.id}/view`;
}

export async function uploadPdfToFolder(
  folderId: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  return uploadFileToFolder(folderId, filename, buffer, "application/pdf");
}

async function exportSpreadsheetXlsx(spreadsheetId: string): Promise<Buffer> {
  const drive = await getDriveClient();
  const res = await drive.files.export(
    {
      fileId: spreadsheetId,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
    { responseType: "arraybuffer" }
  );
  const data = res.data as ArrayBuffer | Buffer | Uint8Array;
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  return Buffer.from(new Uint8Array(data));
}

export async function uploadSpreadsheetXlsxBackup(
  destFolderId: string,
  date = new Date()
): Promise<string> {
  const spreadsheetId = getSpreadsheetId();
  const label = formatBackupDate(date);
  const buffer = await exportSpreadsheetXlsx(spreadsheetId);
  return uploadFileToFolder(
    destFolderId,
    `Impackt-Fitness-PT-Tracker-Backup-${label}.xlsx`,
    buffer,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

export function getMonthFolderWebLink(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export async function ensureCultInvoiceFolders(): Promise<{
  cultInvoicesUrl: string;
  settlementUrl: string;
  taxInvoiceUrl: string;
}> {
  const rootId = getDriveFolderId();
  const cultId = await ensureFolder(rootId, CULT_INVOICES_FOLDER);
  const settlementId = await ensureFolder(cultId, CULT_SETTLEMENT_FOLDER);
  const taxId = await ensureFolder(cultId, CULT_TAX_INVOICE_FOLDER);
  return {
    cultInvoicesUrl: getMonthFolderWebLink(cultId),
    settlementUrl: getMonthFolderWebLink(settlementId),
    taxInvoiceUrl: getMonthFolderWebLink(taxId),
  };
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

async function annotateBackupFolder(folderId: string, description: string) {
  try {
    const drive = await getDriveClient();
    await drive.files.update({
      fileId: folderId,
      requestBody: { description },
      supportsAllDrives: true,
    });
  } catch {
    // Non-fatal — empty folder is still better with a description when it works
  }
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

  const tabsToBackup = [...TRAINER_SHEET_TABS, EXPENSES_TAB_NAME];

  for (const tabName of tabsToBackup) {
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
    throw new Error("No trainer or expenses tabs found to back up in the spreadsheet");
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
  method: "drive_copy" | "xlsx_export" | "sheet_tabs";
  folderName?: string;
  folderUrl?: string;
  fileUrl?: string | null;
  spreadsheetUrl?: string;
  tabNames?: string[];
};

/**
 * Prefer a full Drive file copy into Backups/YYYY-MM-DD.
 * If copy fails (service-account quota), export an .xlsx into that folder
 * so it is not left empty. Last resort: copy tabs inside the spreadsheet.
 */
export async function backupPtTrackerSpreadsheet(
  date = new Date()
): Promise<SheetFileBackupResult> {
  const errors: string[] = [];
  let folder: { folderId: string; folderName: string } | null = null;

  try {
    folder = await ensureWeeklyBackupFolder(date);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  if (folder) {
    try {
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
      const fileUrl = await uploadSpreadsheetXlsxBackup(folder.folderId, date);
      return {
        method: "xlsx_export",
        folderName: folder.folderName,
        folderUrl: getMonthFolderWebLink(folder.folderId),
        fileUrl,
      };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  try {
    const tabs = await backupTrainerTabsInSpreadsheet(date);
    if (folder) {
      await annotateBackupFolder(
        folder.folderId,
        `Drive file copy failed. Backup is in hidden PT Tracker tabs: ${tabs.tabNames.join(", ")}`
      );
    }
    return {
      method: "sheet_tabs",
      folderName: folder?.folderName ?? formatBackupDate(date),
      folderUrl: folder ? getMonthFolderWebLink(folder.folderId) : undefined,
      fileUrl: tabs.spreadsheetUrl,
      spreadsheetUrl: tabs.spreadsheetUrl,
      tabNames: tabs.tabNames,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    throw new Error(`Sheet backup failed: ${errors.join(" | ")}`);
  }
}
