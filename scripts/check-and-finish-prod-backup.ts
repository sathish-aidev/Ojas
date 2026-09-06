/**
 * Diagnose why Drive snapshot folders look empty, then finish a Google backup
 * that does not need service-account storage (hidden tabs on the live sheet).
 *
 *   npx tsx scripts/check-and-finish-prod-backup.ts
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { google } from "googleapis";
import { envFilePath, parseEnvFile } from "./env-file";

process.env.ALLOW_PRODUCTION_GOOGLE = "1";
config({ path: ".env.vercel.production", override: true });

const SNAPSHOT_FOLDER_ID = "1sdHgu32Uy_hLUPiz1I0D322ohbN72KUD";
const TEST_FOLDER_ID = "1xILcZQ-3faziUFBcWHnLbBArtA4th1Lh";
const LOCAL_DIR = path.resolve(process.cwd(), "backups", "prod-2026-09-05");

async function listFolder(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  label: string
) {
  const meta = await drive.files.get({
    fileId: folderId,
    fields: "id,name,mimeType,driveId,capabilities,owners,shared,webViewLink",
    supportsAllDrives: true,
  });
  const children = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id,name,mimeType,size,webViewLink)",
    pageSize: 50,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  console.log(`\n${label}`);
  console.log(`  name: ${meta.data.name}`);
  console.log(`  url: ${meta.data.webViewLink}`);
  console.log(`  sharedDrive: ${meta.data.driveId ? "yes" : "no (My Drive / shared folder)"}`);
  console.log(`  canAddChildren: ${meta.data.capabilities?.canAddChildren}`);
  console.log(`  canEdit: ${meta.data.capabilities?.canEdit}`);
  const files = children.data.files ?? [];
  console.log(`  children: ${files.length}`);
  for (const file of files) {
    console.log(`    - ${file.name} (${file.mimeType})`);
  }
  return { meta, files };
}

async function main() {
  const prod = parseEnvFile(envFilePath(".env.vercel.production"));
  const liveFolder = prod.GOOGLE_DRIVE_FOLDER_ID;
  const liveSheet = prod.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!liveFolder || !liveSheet) throw new Error("Production Google IDs missing");

  const { getGoogleAuth, ALL_GOOGLE_SCOPES } = await import("../lib/google/google-auth");
  const auth = getGoogleAuth(ALL_GOOGLE_SCOPES);
  const drive = google.drive({ version: "v3", auth });

  const about = await drive.about.get({ fields: "user,storageQuota" });
  const quota = about.data.storageQuota ?? {};
  console.log("Service account");
  console.log(`  email: ${about.data.user?.emailAddress}`);
  console.log(`  limit: ${quota.limit ?? "none"}`);
  console.log(`  usage: ${quota.usage ?? "unknown"}`);
  console.log(`  usageInDrive: ${quota.usageInDrive ?? "unknown"}`);

  const sheet = await drive.files.get({
    fileId: liveSheet,
    fields: "id,name,capabilities,owners,permissions,webViewLink",
    supportsAllDrives: true,
  });
  console.log("\nLive PT spreadsheet");
  console.log(`  name: ${sheet.data.name}`);
  console.log(`  canEdit: ${sheet.data.capabilities?.canEdit}`);
  console.log(`  canCopy: ${sheet.data.capabilities?.canCopy}`);
  console.log(`  url: ${sheet.data.webViewLink}`);

  await listFolder(drive, liveFolder, "Live gym Drive folder");
  try {
    await listFolder(drive, SNAPSHOT_FOLDER_ID, "PROD SNAPSHOT folder (the empty one)");
  } catch (err) {
    console.log("\nPROD SNAPSHOT folder: not readable", err instanceof Error ? err.message : err);
  }
  try {
    await listFolder(drive, TEST_FOLDER_ID, "TEST folder");
  } catch (err) {
    console.log("\nTEST folder: not readable", err instanceof Error ? err.message : err);
  }

  console.log("\nLocal snapshot (this machine)");
  for (const name of [
    "database.json",
    "google-snapshot.json",
    "Impackt-PT-Tracker-PROD-SNAPSHOT-2026-09-05.xlsx",
  ]) {
    const full = path.join(LOCAL_DIR, name);
    if (!fs.existsSync(full)) {
      console.log(`  MISSING ${name}`);
      continue;
    }
    const stat = fs.statSync(full);
    console.log(`  ${name}: ${stat.size} bytes`);
  }

  const canCreateFiles = quota.limit && quota.limit !== "0";
  if (!canCreateFiles) {
    console.log(
      "\nDrive file copy cannot succeed: this service account has no Drive storage quota."
    );
    console.log("Finishing Google backup as hidden tabs on the live PT spreadsheet (no new Drive file).");
  }

  const { backupTrainerTabsInSpreadsheet } = await import("../lib/google/drive-archive");
  const tabs = await backupTrainerTabsInSpreadsheet(new Date("2026-09-05T12:00:00+05:30"));
  console.log("\nHidden tab backup complete");
  console.log(`  spreadsheet: ${tabs.spreadsheetUrl}`);
  console.log(`  tabs: ${tabs.tabNames.join(", ")}`);

  const snapshotPath = path.join(LOCAL_DIR, "google-snapshot.json");
  const prev = fs.existsSync(snapshotPath)
    ? (JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as Record<string, unknown>)
    : {};
  fs.writeFileSync(
    snapshotPath,
    JSON.stringify(
      {
        ...prev,
        method: "hidden_sheet_tabs_plus_local_xlsx",
        hiddenBackupTabs: tabs.tabNames,
        hiddenBackupSpreadsheetUrl: tabs.spreadsheetUrl,
        driveFileCopy: "failed_sa_quota",
        checkedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
