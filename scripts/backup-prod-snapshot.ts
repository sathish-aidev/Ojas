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
import { cleanEnv } from "../lib/env";

process.env.ALLOW_PRODUCTION_GOOGLE = "1";
config({ path: ".env.vercel.production", override: true });
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = cleanEnv(process.env.DATABASE_URL) ?? process.env.DATABASE_URL;
}

function stamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function dumpJson(dir: string): Promise<Record<string, number>> {
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
  const counts = Object.fromEntries(
    Object.entries(payload).map(([name, rows]) => [name, Array.isArray(rows) ? rows.length : 0])
  ) as Record<string, number>;
  console.log(`  JSON tables: ${Object.keys(payload).length} in database.json`);
  return counts;
}

function tryPgDump(dir: string) {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const out = path.join(dir, "neon.dump");
  const native = spawnSync("pg_dump", [url, "--no-owner", "--no-acl", "--no-password", "-f", out], {
    encoding: "utf8",
  });
  if (native.status === 0 && fs.existsSync(out) && fs.statSync(out).size > 0) {
    console.log("  pg_dump: neon.dump");
    return;
  }

  const docker = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "-e",
      `DATABASE_URL=${url}`,
      "-v",
      `${dir.replace(/\\/g, "/")}:/backup`,
      "postgres:17-alpine",
      "sh",
      "-c",
      'pg_dump "$DATABASE_URL" --no-owner --no-acl --no-password -f /backup/neon.dump',
    ],
    { encoding: "utf8" }
  );
  if (docker.status === 0 && fs.existsSync(out) && fs.statSync(out).size > 0) {
    console.log("  pg_dump (docker): neon.dump");
    return;
  }
  const err = `${native.stderr || ""} ${docker.stderr || docker.stdout || ""}`.replaceAll(url, "***");
  console.log("  pg_dump not available — JSON dump only. JSON restore still works.");
  if (err.trim()) console.log(`  pg_dump detail: ${err.slice(0, 400)}`);
}

function writeKitFiles(
  dir: string,
  counts: Record<string, number>
) {
  const prod = parseEnvFile(envFilePath(".env.vercel.production"));
  const sha = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
  const envKeys = Object.keys(prod)
    .filter((key) => !key.startsWith("VERCEL_") && !key.startsWith("TURBO_") && key !== "NX_DAEMON")
    .sort();

  const saRaw = cleanEnv(prod.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (saRaw) {
    try {
      const decoded = saRaw.startsWith("{") ? saRaw : Buffer.from(saRaw, "base64").toString("utf8");
      const parsed = JSON.parse(decoded) as { client_email?: string };
      fs.writeFileSync(path.join(dir, "google-sa.json"), `${JSON.stringify(JSON.parse(decoded), null, 2)}\n`);
      console.log(`  google-sa.json (${parsed.client_email ?? "service account"})`);
    } catch {
      console.log("  Could not write google-sa.json — copy GOOGLE_SERVICE_ACCOUNT_JSON from Vercel by hand.");
    }
  }

  fs.writeFileSync(
    path.join(dir, "env-checklist.txt"),
    [
      "Copy these names from the OLD Vercel project → New Vercel. Do not commit this folder.",
      "",
      "COPY from old project (same Google):",
      "  GOOGLE_DRIVE_FOLDER_ID",
      "  GOOGLE_SHEETS_SPREADSHEET_ID",
      "  GOOGLE_EXPENSES_SPREADSHEET_ID (if set)",
      "  GOOGLE_BACKUP_SPREADSHEET_ID (if set)",
      "  GOOGLE_SERVICE_ACCOUNT_JSON  (or use google-sa.json in this folder)",
      "  OWNER_REPORT_EMAIL",
      "  NEXT_PUBLIC_APP_NAME=Impackt Fitness",
      "  APP_ENV=production",
      "  NEXT_PUBLIC_APP_ENV=production",
      "",
      "GENERATE NEW on the new project:",
      "  DATABASE_URL (new Neon)",
      "  AUTH_SECRET",
      "  AUTH_URL (https://YOUR-NEW-APP.vercel.app)",
      "  CRON_SECRET",
      "  RESEND_API_KEY / RESEND_FROM_EMAIL (optional, new Resend account)",
      "",
      "Keys present in the old Vercel pull (names only):",
      ...envKeys.map((key) => `  ${key}`),
      "",
    ].join("\n")
  );

  const lines = [
    `Impackt live-gym restore kit`,
    `Created: ${new Date().toISOString()}`,
    `Git commit: ${sha || "(unknown)"}`,
    `Keep this folder off git. See docs/RESTORE.md`,
    "",
    "Table counts:",
    ...Object.entries(counts).map(([name, n]) => `  ${name}: ${n}`),
    "",
    "Files:",
    ...fs.readdirSync(dir).map((name) => `  ${name}`),
    "",
  ];
  fs.writeFileSync(path.join(dir, "MANIFEST.txt"), `${lines.join("\n")}\n`);
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
  const counts = await dumpJson(dir);
  try {
    await copySheet(dir);
  } catch (err) {
    console.warn("  Google snapshot failed:", err instanceof Error ? err.message : err);
    console.warn("  Database JSON dump is still in this folder.");
  }
  writeKitFiles(dir, counts);
  console.log("\nProduction snapshot complete. Keep this folder off git.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
