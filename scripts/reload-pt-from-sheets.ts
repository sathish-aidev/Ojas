/**
 * Wipe PT/client data and re-import from trainer Google Sheets (or a saved snapshot).
 * Keeps gym, users, trainers, split rules, expenses, and Cult settlements.
 *
 * Dry run:         npx tsx scripts/reload-pt-from-sheets.ts --prod
 * From snapshot:   npx tsx scripts/reload-pt-from-sheets.ts --prod --from-snapshot --apply
 * Live sheet:      npx tsx scripts/reload-pt-from-sheets.ts --prod --apply
 */
import { config } from "dotenv";

const prod = process.argv.includes("--prod");
const apply = process.argv.includes("--apply");
const fromSnapshot = process.argv.includes("--from-snapshot");
config({ path: prod ? ".env.vercel.production" : ".env", override: true });

async function clearPtData(prisma: import("@prisma/client").PrismaClient) {
  await prisma.notification.deleteMany();
  await prisma.payrollLineItem.deleteMany();
  await prisma.payrollRun.deleteMany();
  await prisma.progressPhoto.deleteMany();
  await prisma.dietProgram.deleteMany();
  await prisma.clientNote.deleteMany();
  await prisma.measurement.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.pTSubscription.deleteMany();
  await prisma.session.deleteMany();
  await prisma.trainerSlot.deleteMany();
  await prisma.client.deleteMany();
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { TRAINER_SHEET_TABS } = await import("../lib/sheet-config");
  const { fetchSheetTab } = await import("../lib/google/sheets-client");
  const { parseGymSheetRows } = await import("../lib/import/parse-gym-sheet");
  const { syncTrainerTab } = await import("../lib/services/sheet-sync");
  const { exportGymToGoogleSheet } = await import("../lib/services/sheet-export");
  const { getTrainerMonthlyReport } = await import("../lib/services/trainer-monthly-report");
  const { toYmd } = await import("../lib/date-ymd");

  const prisma = new PrismaClient();
  console.log(prod ? "Target: production database" : "Target: local database");

  try {
    const gym = await prisma.gym.findFirst();
    if (!gym) throw new Error("No gym found");

    const beforeClients = await prisma.client.count();
    const beforeSubs = await prisma.pTSubscription.count();
    const beforePayments = await prisma.payment.count();
    console.log(`Current: ${beforeClients} clients, ${beforeSubs} packs, ${beforePayments} installments`);

    const snapshots: Array<{
      tabName: string;
      rawRows: string[][];
      parsedCount: number;
      errors: number;
    }> = [];

    if (fromSnapshot) {
      const run = await prisma.sheetSyncRun.findFirst({
        where: {
          status: "SUCCESS",
          source: { in: ["MANUAL", "DAILY", "CRON"] },
          snapshots: { some: { tabName: "Sai Karan" } },
        },
        orderBy: { createdAt: "desc" },
        include: { snapshots: true },
      });
      if (!run) throw new Error("No successful trainer sheet snapshot found");
      console.log(`Restoring from snapshot ${run.createdAt.toISOString()} (${run.source})`);
      for (const tabName of TRAINER_SHEET_TABS) {
        const snap = run.snapshots.find((s) => s.tabName === tabName);
        if (!snap) throw new Error(`Snapshot missing tab ${tabName}`);
        const rawRows = snap.rawRows as string[][];
        const parsed = parseGymSheetRows(rawRows);
        snapshots.push({
          tabName,
          rawRows,
          parsedCount: parsed.rows.length,
          errors: parsed.errors.length,
        });
        console.log(
          `  Snapshot ${tabName}: ${parsed.rows.length} rows, ${parsed.errors.length} parse error(s)`
        );
      }
    } else {
      for (const tabName of TRAINER_SHEET_TABS) {
        const rawRows = await fetchSheetTab(tabName);
        const parsed = parseGymSheetRows(rawRows);
        snapshots.push({
          tabName,
          rawRows,
          parsedCount: parsed.rows.length,
          errors: parsed.errors.length,
        });
        console.log(
          `  Sheet ${tabName}: ${parsed.rows.length} rows, ${parsed.errors.length} parse error(s)`
        );
        if (parsed.errors.length) {
          for (const err of parsed.errors.slice(0, 5)) {
            console.log(`    row ${err.rowNumber}: ${err.message}`);
          }
        }
      }
    }

    const empty = snapshots.filter((s) => s.parsedCount === 0);
    if (empty.length) {
      throw new Error(
        `Abort: empty parsed tabs (${empty.map((s) => s.tabName).join(", ")}). Google Sheets were not changed.`
      );
    }

    if (!apply) {
      console.log("\nDry run. Pass --apply to wipe PT data and re-import. Sheets are not rewritten until import succeeds.");
      return;
    }

    console.log("\nWiping clients, PT packs, payments, sessions, and payroll…");
    await clearPtData(prisma);
    console.log("Wipe complete. Re-importing from the fetched sheet snapshots…");

    for (const snap of snapshots) {
      const result = await syncTrainerTab(gym.id, snap.tabName, snap.rawRows);
      console.log(
        `  ${result.tabName}: parsed=${result.rowsParsed} created=${result.created} updated=${result.updated} errors=${result.errors.length}`
      );
      for (const err of result.errors.slice(0, 8)) {
        console.log(`    ${err}`);
      }
      if (result.errors.length > 0) {
        throw new Error(`Import failed on ${result.tabName}. Google Sheets were not rewritten.`);
      }
    }

    const sai = await prisma.employee.findFirst({
      where: {
        employeeType: "TRAINER",
        user: { name: { equals: "Sai Karan", mode: "insensitive" } },
      },
      include: { user: true },
    });
    if (!sai) throw new Error("Trainer Sai Karan not found after import");

    const yeswanth = await prisma.client.findFirst({
      where: { trainerId: sai.id, name: { equals: "yeswanth", mode: "insensitive" } },
      include: { subscriptions: { include: { payments: { orderBy: { installmentIndex: "asc" } } } } },
    });
    if (!yeswanth || yeswanth.subscriptions.length !== 1) {
      throw new Error(
        `Expected 1 yeswanth pack, found ${yeswanth?.subscriptions.length ?? 0}`
      );
    }
    const inst = yeswanth.subscriptions[0].payments;
    const months = inst.map((p) => p.paidAt.getMonth() + 1);
    console.log(
      `yeswanth installments: ${inst
        .map((p) => `${toYmd(p.paidAt)} (inst ${p.installmentIndex})`)
        .join(", ")}`
    );
    if (months[1] !== 2) {
      throw new Error(`Installment 1 must be February, got month ${months[1]}`);
    }
    const marchCount = inst.filter((p) => p.paidAt.getMonth() === 2).length;
    if (marchCount !== 1) {
      throw new Error(`Expected 1 March installment for yeswanth, got ${marchCount}`);
    }

    const vikram = await prisma.client.findFirst({
      where: { trainerId: sai.id, name: { equals: "Vikram", mode: "insensitive" } },
      include: { subscriptions: { orderBy: { startDate: "asc" } } },
    });
    const vikramStart = vikram?.subscriptions[0]?.startDate;
    console.log(`Vikram first pack start: ${vikramStart ? toYmd(vikramStart) : "missing"}`);
    if (!vikramStart || vikramStart.getMonth() !== 2 || vikramStart.getDate() !== 1) {
      throw new Error("Vikram pack must start 1 March 2026 (01/03/2026), not 3 January");
    }

    const report = await getTrainerMonthlyReport(sai.id, 3, 2026);
    const yeswanthRows = report?.rows.filter((r) => r.clientName.toLowerCase() === "yeswanth") ?? [];
    console.log(`March PT report yeswanth rows: ${yeswanthRows.length}`);
    if (yeswanthRows.length !== 1) {
      throw new Error(`March report still has ${yeswanthRows.length} yeswanth row(s)`);
    }

    const afterClients = await prisma.client.count();
    const afterSubs = await prisma.pTSubscription.count();
    console.log(`Imported: ${afterClients} clients, ${afterSubs} packs`);

    console.log("Rewriting trainer Google tabs as DD/MM/YYYY from the database…");
    const exported = await exportGymToGoogleSheet(gym.id);
    for (const tab of exported) {
      console.log(`  wrote ${tab.tabName}: ${tab.rowCount} rows`);
    }

    console.log("\nReload complete. March Sai Karan report has a single yeswanth row.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
