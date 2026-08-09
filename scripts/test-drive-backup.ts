/**
 * Diagnose Drive weekly-backup failures (no DB required).
 *   npx tsx scripts/test-drive-backup.ts
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { google } from "googleapis";
import { getGoogleAuth, ALL_GOOGLE_SCOPES } from "../lib/google/google-auth";
import {
  getDriveFolderId,
  getSpreadsheetId,
  WEEKLY_BACKUPS_FOLDER,
} from "../lib/sheet-config";
import {
  ensureWeeklyBackupFolder,
  copySpreadsheetWeeklyBackup,
} from "../lib/google/drive-archive";

async function main() {
  const folderId = getDriveFolderId();
  const spreadsheetId = getSpreadsheetId();
  console.log("Drive folder:", folderId);
  console.log("Spreadsheet:", spreadsheetId);

  const auth = getGoogleAuth(ALL_GOOGLE_SCOPES);
  const drive = google.drive({ version: "v3", auth });
  const about = await drive.about.get({ fields: "user,storageQuota" });
  console.log("SA email:", about.data.user?.emailAddress);
  console.log("Storage quota:", JSON.stringify(about.data.storageQuota));

  const root = await drive.files.get({
    fileId: folderId,
    fields: "id,name,mimeType,driveId,capabilities",
    supportsAllDrives: true,
  });
  console.log("Root folder:", {
    name: root.data.name,
    driveId: root.data.driveId ?? "(My Drive / shared folder)",
    canAddChildren: root.data.capabilities?.canAddChildren,
  });

  try {
    const folder = await ensureWeeklyBackupFolder();
    console.log("Weekly folder OK:", folder);
    const link = await copySpreadsheetWeeklyBackup(folder.folderId);
    console.log("Copy OK:", link);
  } catch (err) {
    console.error("Backup failed:");
    console.error(err instanceof Error ? err.message : err);
    if (err && typeof err === "object" && "errors" in err) {
      console.error(JSON.stringify((err as { errors: unknown }).errors, null, 2));
    }
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
