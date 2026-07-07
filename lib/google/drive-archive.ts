import { google } from "googleapis";
import { Readable } from "stream";
import { getGoogleAuth, ALL_GOOGLE_SCOPES } from "./google-auth";
import {
  getDriveFolderId,
  getSpreadsheetId,
  PT_SPREADSHEET_NAME,
  REPORTS_FOLDER_NAME,
  WEEKLY_BACKUPS_FOLDER,
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

async function findChildFolder(
  parentId: string,
  name: string
): Promise<string | null> {
  const drive = await getDriveClient();
  const q = `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await drive.files.list({
    q,
    fields: "files(id,name)",
    pageSize: 1,
  });
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
  const res = await drive.files.list({
    q,
    fields: "files(id,name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
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
  });
  if (!res.data.id) throw new Error(`Failed to upload ${filename}`);
  return res.data.webViewLink ?? `https://drive.google.com/file/d/${res.data.id}/view`;
}

export function getMonthFolderWebLink(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export async function ensureWeeklyBackupFolder(date = new Date()): Promise<{
  folderId: string;
  folderName: string;
}> {
  const rootId = getDriveFolderId();
  const backupsId = await ensureFolder(rootId, WEEKLY_BACKUPS_FOLDER);
  const folderName = date.toISOString().slice(0, 10);
  const folderId = await ensureFolder(backupsId, folderName);
  return { folderId, folderName };
}

export async function copySpreadsheetWeeklyBackup(
  destFolderId: string,
  date = new Date()
): Promise<string> {
  const drive = await getDriveClient();
  const spreadsheetId = getSpreadsheetId();
  const label = date.toISOString().slice(0, 10);
  const res = await drive.files.copy({
    fileId: spreadsheetId,
    requestBody: {
      name: `Ojas-PT-Tracker-Backup-${label}`,
      parents: [destFolderId],
    },
    fields: "id,webViewLink",
    supportsAllDrives: true,
  });
  if (!res.data.id) throw new Error("Failed to copy weekly spreadsheet backup");
  await transferFileToOwner(drive, res.data.id);
  return res.data.webViewLink ?? `https://drive.google.com/file/d/${res.data.id}/view`;
}
