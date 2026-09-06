/**
 * Snapshot live Neon + PT spreadsheet. Does not change production data.
 *
 *   npx tsx scripts/backup-prod-snapshot.ts
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { google } from "googleapis";
import { envFilePath, parseEnvFile } from "./env-file";

process.env.ALLOW_PRODUCTION_GOOGLE = "1";
config({ path: ".env.vercel.production", override: true });

function stamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function dumpJson(dir: string) {
  const { prisma } = await import("../lib/prisma");
  const payload = {
    gym: await prisma.gym.findMany(),
    user: await prisma.user.findMany(),
    employee: await prisma.employee.findMany(),
    trainerSplitRule: await prisma.trainerSplitRule.findMany(),
    client: await prisma.client.findMany(),
    pTSubscription: await prisma.pTSubscription.findMany(),
    payment: await prisma.payment.findMany(),
    session: await prisma.session.findMany(),
    trainerSlot: await prisma.trainerSlot.findMany(),
    goal: await prisma.goal.findMany(),
    measurement: await prisma.measurement.findMany(),
    clientNote: await prisma.clientNote.findMany(),
    dietProgram: await prisma.dietProgram.findMany(),
    progressPhoto: await prisma.progressPhoto.findMany(),
    payrollRun: await prisma.payrollRun.findMany(),
    payrollLineItem: await prisma.payrollLineItem.findMany(),
    monthlySalaryOverride: await prisma.monthlySalaryOverride.findMany(),
    gymExpense: await prisma.gymExpense.findMany(),
    cultSettlement: await prisma.cultSettlement.findMany(),
    notification: await prisma.notification.findMany(),
    sheetSyncRun: await prisma.sheetSyncRun.findMany(),
    sheetTabSnapshot: await prisma.sheetTabSnapshot.findMany(),
  };
  fs.writeFileSync(path.join(dir, "database.json"), JSON.stringify(payload, null, 2), "utf8");
  await prisma.$disconnect();
  console.log(`  JSON tables: ${Object.keys(payload).length} files in database.json`);
}

function tryPgDump(dir: string) {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const out = path.join(dir, "neon.dump");
  const result = spawnSync("pg_dump", [url, "--no-owner", "--no-acl", "-f", out], {
    encoding: "utf8",
  });
  if (result.status === 0) {
    console.log("  pg_dump: neon.dump");
    return;
  }
  console.log("  pg_dump not available — JSON dump only.");
}

async function copySheet(dir: string) {
  const prod = parseEnvFile(envFilePath(".env.vercel.production"));
  const folderId = prod.GOOGLE_DRIVE_FOLDER_ID;
  const sheetId = prod.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!folderId || !sheetId) {
    console.log("  Skipping Drive copy (Google IDs missing).");
    return;
  }

  const { getGoogleAuth, ALL_GOOGLE_SCOPES } = await import("../lib/google/google-auth");
  const { ensureFolder, uploadFileToFolder } = await import("../lib/google/drive-archive");
  const auth = getGoogleAuth(ALL_GOOGLE_SCOPES);
  const drive = google.drive({ version: "v3", auth });
  const snapshotName = `Impackt — PROD SNAPSHOT ${stamp()}`;
  const snapshotId = await ensureFolder(folderId, snapshotName);

  const meta: Record<string, string | null | undefined> = {
    snapshotFolderId: snapshotId,
    snapshotFolderUrl: `https://drive.google.com/drive/folders/${snapshotId}`,
    liveSpreadsheetId: sheetId,
    liveDriveFolderId: folderId,
  };

  try {
    const copy = await drive.files.copy({
      fileId: sheetId,
      requestBody: {
        name: `Impackt PT Tracker — PROD SNAPSHOT ${stamp()}`,
        parents: [snapshotId],
      },
      fields: "id,webViewLink",
      supportsAllDrives: true,
    });
    meta.method = "drive_copy";
    meta.spreadsheetCopyId = copy.data.id;
    meta.spreadsheetCopyUrl = copy.data.webViewLink;
    console.log(`  Sheet copy: ${meta.spreadsheetCopyUrl ?? meta.spreadsheetCopyId}`);
  } catch (err) {
    console.log(
      `  Native sheet copy failed (${err instanceof Error ? err.message : "unknown"}). Exporting xlsx instead.`
    );
    const res = await drive.files.export(
      {
        fileId: sheetId,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      { responseType: "arraybuffer" }
    );
    const data = res.data as ArrayBuffer | Buffer | Uint8Array;
    const buffer = Buffer.isBuffer(data)
      ? data
      : Buffer.from(data instanceof Uint8Array ? data : new Uint8Array(data));
    const xlsxName = `Impackt-PT-Tracker-PROD-SNAPSHOT-${stamp()}.xlsx`;
    fs.writeFileSync(path.join(dir, xlsxName), buffer);
    meta.localXlsx = xlsxName;
    try {
      const fileUrl = await uploadFileToFolder(
        snapshotId,
        xlsxName,
        buffer,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      meta.method = "xlsx_export";
      meta.spreadsheetCopyUrl = fileUrl;
      console.log(`  xlsx snapshot: ${fileUrl}`);
    } catch (uploadErr) {
      meta.method = "local_xlsx_only";
      console.log(
        `  Drive xlsx upload failed (${uploadErr instanceof Error ? uploadErr.message : "unknown"}). Kept local file ${xlsxName}.`
      );
    }
  }

  fs.writeFileSync(path.join(dir, "google-snapshot.json"), JSON.stringify(meta, null, 2), "utf8");
}

async function main() {
  const day = stamp();
  const dir = path.resolve(process.cwd(), "backups", `prod-${day}`);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`Writing production snapshot to ${dir}`);
  tryPgDump(dir);
  await dumpJson(dir);
  try {
    await copySheet(dir);
  } catch (err) {
    console.warn("  Google snapshot failed:", err instanceof Error ? err.message : err);
    console.warn("  Database JSON dump is still in this folder.");
  }
  console.log("\nProduction snapshot complete. Keep this folder off git.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
