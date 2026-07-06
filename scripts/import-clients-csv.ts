/**
 * Import historical client PT data from Google Sheet CSV exports.
 *
 * Usage:
 *   npm run import:clients -- --file "resources/Impackt1_Gym - PT-Sai.csv" --trainer Sai --dry-run
 *   npm run import:clients -- --file "resources/Impackt1_Gym - PT-Sai.csv" --trainer Sai
 */
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { parseGymCsv } from "../lib/import/parse-gym-csv";
import { formatDateDMY } from "../lib/import/parse-csv-dates";
import { createSubscriptionWithPayment } from "../lib/services/pt-tracker";
import { recalculateTrainerMonthSplits } from "../lib/services/trainer-split";
import { allocateMonthlyInstallments } from "../lib/services/payment-allocation";

function getArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

const dryRun = process.argv.includes("--dry-run");
const fileArg = getArg("file");
const trainerArg = getArg("trainer");

async function findTrainerByName(name: string) {
  const gym = await prisma.gym.findFirst();
  if (!gym) throw new Error("No gym found. Run npm run db:seed first.");

  const trainer = await prisma.employee.findFirst({
    where: {
      gymId: gym.id,
      employeeType: "TRAINER",
      user: { name: { equals: name, mode: "insensitive" } },
    },
    include: { user: true },
  });

  if (!trainer) {
    throw new Error(
      `Trainer "${name}" not found. Run: npx tsx scripts/setup-trainers-for-import.ts`
    );
  }

  return { gym, trainer };
}

async function findOrCreateClient(gymId: string, trainerId: string, name: string) {
  const trimmed = name.trim();
  let client = await prisma.client.findFirst({
    where: { gymId, trainerId, name: trimmed },
  });

  if (!client) {
    client = await prisma.client.create({
      data: { gymId, trainerId, name: trimmed, status: "ACTIVE" },
    });
  }

  return client;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}`;
}

async function main() {
  if (!fileArg || !trainerArg) {
    console.error("Usage: npm run import:clients -- --file <path> --trainer <name> [--dry-run]");
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const { rows, errors, headerRowIndex } = parseGymCsv(content);

  console.log(`\n=== CSV Import ${dryRun ? "(DRY RUN)" : ""} ===`);
  console.log(`File: ${filePath}`);
  console.log(`Trainer: ${trainerArg}`);
  console.log(`Header row: ${headerRowIndex + 1}`);
  console.log(`Parsed rows: ${rows.length}`);

  if (errors.length > 0) {
    console.error("\nErrors:");
    for (const e of errors) {
      console.error(`  Row ${e.rowNumber}: ${e.message}`);
    }
    process.exit(1);
  }

  const sortedRows = [...rows].sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime()
  );

  const warningCount = sortedRows.filter((r) => r.warnings.length > 0).length;
  if (warningCount > 0) {
    console.log(`\nWarnings (${warningCount} rows):`);
    for (const row of sortedRows) {
      for (const w of row.warnings) {
        console.warn(`  Row ${row.rowNumber} [${row.customer}]: ${w}`);
      }
    }
  }

  console.log("\n--- Preview ---");
  console.log(
    "Row".padEnd(5) +
      "Customer".padEnd(22) +
      "Amount".padStart(10) +
      "Mo".padStart(4) +
      "  Start".padEnd(12) +
      "End".padEnd(12) +
      "Installments"
  );
  console.log("-".repeat(80));

  for (const row of sortedRows) {
    const inst = allocateMonthlyInstallments(row.amount, row.startDate, row.monthsCount);
    const instStr = inst.map((i) => `₹${i.amount}`).join(" + ");
    console.log(
      String(row.rowNumber).padEnd(5) +
        row.customer.slice(0, 20).padEnd(22) +
        String(row.amount).padStart(10) +
        String(row.monthsCount).padStart(4) +
        "  " +
        formatDateDMY(row.startDate).padEnd(12) +
        formatDateDMY(row.endDate).padEnd(12) +
        instStr
    );
  }

  if (dryRun) {
    console.log(`\nDry run complete. ${sortedRows.length} rows ready to import.`);
    return;
  }

  const { gym, trainer } = await findTrainerByName(trainerArg);
  const touchedMonths = new Set<string>();
  let clientsCreated = 0;
  let subscriptionsCreated = 0;

  for (const row of sortedRows) {
    const existingClient = await prisma.client.findFirst({
      where: { gymId: gym.id, trainerId: trainer.id, name: row.customer.trim() },
    });

    const client = await findOrCreateClient(gym.id, trainer.id, row.customer);
    if (!existingClient) clientsCreated++;

    await createSubscriptionWithPayment({
      clientId: client.id,
      amount: row.amount,
      paymentDate: row.paymentDate,
      startDate: row.startDate,
      endDate: row.endDate,
      monthsCount: row.monthsCount,
      paymentMode: row.paymentMode,
      notes: row.paymentNotes || undefined,
    });

    subscriptionsCreated++;

    touchedMonths.add(monthKey(row.paymentDate));
    const inst = allocateMonthlyInstallments(row.amount, row.startDate, row.monthsCount);
    for (const i of inst) {
      touchedMonths.add(monthKey(i.serviceDate));
    }

    console.log(`  Imported row ${row.rowNumber}: ${row.customer}`);
  }

  const sortedMonthKeys = [...touchedMonths].sort((a, b) => {
    const [yA, mA] = a.split("-").map(Number);
    const [yB, mB] = b.split("-").map(Number);
    return yA !== yB ? yA - yB : mA - mB;
  });

  console.log("\nRecalculating trainer splits for touched months...");
  for (const key of sortedMonthKeys) {
    const [year, month] = key.split("-").map(Number);
    await recalculateTrainerMonthSplits(trainer.id, month, year);
    console.log(`  Recalculated ${month}/${year}`);
  }

  console.log(`\nImport complete.`);
  console.log(`  Clients created: ${clientsCreated}`);
  console.log(`  Subscriptions created: ${subscriptionsCreated}`);
  console.log(`  Months recalculated: ${sortedMonthKeys.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
