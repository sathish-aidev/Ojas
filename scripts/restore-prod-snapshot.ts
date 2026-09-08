/**
 * Restore a live-gym snapshot into an EMPTY Neon/Postgres database.
 *
 *   $env:CONFIRM_RESTORE="YES"
 *   $env:DATABASE_URL="postgresql://...NEW..."
 *   npx tsx scripts/restore-prod-snapshot.ts backups/prod-YYYY-MM-DD
 *
 * Never point DATABASE_URL at the old live gym. This script refuses known live hosts
 * unless ALLOW_RESTORE_TO_LIVE=1.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { cleanEnv } from "../lib/env";

const LIVE_HOST_MARKERS = ["ep-delicate-bonus", "lingering-surf-62682822"];

const TABLE_ORDER = [
  "gym",
  "user",
  "employee",
  "trainerSplitRule",
  "client",
  "pTSubscription",
  "payment",
  "session",
  "trainerSlot",
  "goal",
  "measurement",
  "clientNote",
  "dietProgram",
  "progressPhoto",
  "payrollRun",
  "payrollLineItem",
  "monthlySalaryOverride",
  "gymExpense",
  "cultSettlement",
  "notification",
  "sheetSyncRun",
  "sheetTabSnapshot",
] as const;

const DATE_KEYS = new Set([
  "createdAt",
  "updatedAt",
  "joinedAt",
  "joinDate",
  "paymentDate",
  "startDate",
  "endDate",
  "paidAt",
  "payableAt",
  "collectedAt",
  "scheduledAt",
  "startTime",
  "endTime",
  "startAt",
  "endAt",
  "deadline",
  "recordedAt",
  "takenAt",
  "periodStart",
  "periodEnd",
  "targetSplitAppliesFrom",
]);

type TableName = (typeof TABLE_ORDER)[number];

function assertSafeTarget(url: string) {
  const lower = url.toLowerCase();
  const hitsLive = LIVE_HOST_MARKERS.some((marker) => lower.includes(marker));
  if (hitsLive && process.env.ALLOW_RESTORE_TO_LIVE !== "1") {
    throw new Error(
      "DATABASE_URL looks like the current live gym. Restore into a NEW Neon instance. " +
        "If you really mean the old host, set ALLOW_RESTORE_TO_LIVE=1."
    );
  }
}

function reviveRow(row: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...row };
  for (const [key, value] of Object.entries(out)) {
    if (DATE_KEYS.has(key) && typeof value === "string") {
      out[key] = new Date(value);
    }
  }
  return out;
}

function runSqlDump(url: string, dumpPath: string) {
  const native = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-f", dumpPath], {
    encoding: "utf8",
  });
  if (native.status === 0) return "psql";

  const dir = path.dirname(dumpPath);
  const file = path.basename(dumpPath);
  const docker = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "-v",
      `${dir}:/backup`,
      "postgres:17-alpine",
      "psql",
      url,
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      `/backup/${file}`,
    ],
    { encoding: "utf8" }
  );
  if (docker.status === 0) return "docker psql";
  throw new Error(
    `Could not apply neon.dump. Install PostgreSQL client tools or Docker.\n${docker.stderr || native.stderr}`
  );
}

async function restoreJson(url: string, jsonPath: string) {
  const payload = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as Record<string, unknown[]>;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const delegate: Record<TableName, { createMany: (args: { data: unknown[] }) => Promise<{ count: number }> }> = {
    gym: prisma.gym,
    user: prisma.user,
    employee: prisma.employee,
    trainerSplitRule: prisma.trainerSplitRule,
    client: prisma.client,
    pTSubscription: prisma.pTSubscription,
    payment: prisma.payment,
    session: prisma.session,
    trainerSlot: prisma.trainerSlot,
    goal: prisma.goal,
    measurement: prisma.measurement,
    clientNote: prisma.clientNote,
    dietProgram: prisma.dietProgram,
    progressPhoto: prisma.progressPhoto,
    payrollRun: prisma.payrollRun,
    payrollLineItem: prisma.payrollLineItem,
    monthlySalaryOverride: prisma.monthlySalaryOverride,
    gymExpense: prisma.gymExpense,
    cultSettlement: prisma.cultSettlement,
    notification: prisma.notification,
    sheetSyncRun: prisma.sheetSyncRun,
    sheetTabSnapshot: prisma.sheetTabSnapshot,
  };

  try {
    for (const table of TABLE_ORDER) {
      const rows = payload[table];
      if (!Array.isArray(rows) || rows.length === 0) {
        console.log(`  ${table}: 0`);
        continue;
      }
      const data = rows.map((row) => reviveRow(row as Record<string, unknown>));
      const chunkSize = 200;
      let inserted = 0;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        const result = await delegate[table].createMany({ data: chunk });
        inserted += result.count;
      }
      console.log(`  ${table}: ${inserted}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (process.env.CONFIRM_RESTORE !== "YES") {
    throw new Error('Refusing to restore. Set CONFIRM_RESTORE=YES and pass the snapshot folder.');
  }
  const dir = path.resolve(process.argv[2] || "");
  if (!dir || !fs.existsSync(dir)) {
    throw new Error("Pass the snapshot folder, e.g. backups/prod-2026-09-07");
  }
  const url = cleanEnv(process.env.DATABASE_URL);
  if (!url) throw new Error("DATABASE_URL is required (the NEW empty database).");
  assertSafeTarget(url);

  const dumpPath = path.join(dir, "neon.dump");
  const jsonPath = path.join(dir, "database.json");
  if (!fs.existsSync(dumpPath) && !fs.existsSync(jsonPath)) {
    throw new Error("Folder has neither neon.dump nor database.json");
  }

  function pushSchema() {
    const pushed = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], {
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: url },
      shell: process.platform === "win32",
    });
    if (pushed.status !== 0) {
      throw new Error(pushed.stderr || pushed.stdout || "prisma db push failed");
    }
  }

  if (fs.existsSync(dumpPath) && fs.statSync(dumpPath).size > 0) {
    console.log("Restoring neon.dump into the empty database…");
    const how = runSqlDump(url, dumpPath);
    console.log(`  Applied with ${how}`);
    console.log("Syncing Prisma schema after dump…");
    pushSchema();
    return;
  }

  console.log("Pushing Prisma schema, then restoring database.json…");
  pushSchema();
  await restoreJson(url, jsonPath);
  console.log("JSON restore complete.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
