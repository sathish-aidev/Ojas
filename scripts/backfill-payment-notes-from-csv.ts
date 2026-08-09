/**
 * Backfill payment mode + notes on first installment from legacy CSV exports.
 * Run: npm run backfill:payment-notes
 */
import { readFileSync } from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { parseGymCsv } from "../lib/import/parse-gym-csv";
import { formatDateDMY } from "../lib/import/parse-csv-dates";

const CSV_BY_TRAINER: Record<string, string> = {
  Rohith: "Impackt1_Gym - PT-Rohith.csv",
  "Sai Karan": "Impackt1_Gym - PT-Sai.csv",
  Rahul: "Impackt1_Gym - PT-Rahul.csv",
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const gym = await prisma.gym.findFirst();
  if (!gym) throw new Error("No gym found");

  let updated = 0;
  let skipped = 0;

  for (const [trainerName, fileName] of Object.entries(CSV_BY_TRAINER)) {
    const filePath = path.join(process.cwd(), "resources", fileName);
    const content = readFileSync(filePath, "utf8");
    const { rows, errors } = parseGymCsv(content);

    if (errors.length) {
      console.warn(`Warnings parsing ${fileName}:`, errors);
    }

    const trainer = await prisma.employee.findFirst({
      where: {
        gymId: gym.id,
        employeeType: "TRAINER",
        user: { name: { equals: trainerName, mode: "insensitive" } },
      },
    });
    if (!trainer) {
      console.warn(`Trainer not found: ${trainerName}`);
      continue;
    }

    console.log(`\n${trainerName}: ${rows.length} CSV rows`);

    for (const row of rows) {
      const client = await prisma.client.findFirst({
        where: {
          gymId: gym.id,
          trainerId: trainer.id,
          name: { equals: row.customer.trim(), mode: "insensitive" },
        },
      });
      if (!client) {
        skipped++;
        continue;
      }

      const sub = await prisma.pTSubscription.findFirst({
        where: {
          clientId: client.id,
          startDate: { gte: startOfDay(row.startDate), lte: endOfDay(row.startDate) },
          amount: row.amount,
        },
        include: {
          payments: { orderBy: { installmentIndex: "asc" }, take: 1 },
        },
      });
      if (!sub) {
        skipped++;
        continue;
      }

      const payment = sub.payments[0];
      if (!payment) {
        skipped++;
        continue;
      }

      const needsMode = payment.paymentMode !== row.paymentMode;
      const needsNotes =
        (payment.notes ?? "").trim() !== row.paymentNotes.trim() &&
        row.paymentNotes.trim().length > 0;

      if (!needsMode && !needsNotes) continue;

      console.log(
        `  ${row.customer} (${formatDateDMY(row.startDate)}): ${payment.paymentMode} → ${row.paymentMode}, notes → "${row.paymentNotes.slice(0, 40)}"`
      );

      if (!dryRun) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            paymentMode: row.paymentMode,
            notes: row.paymentNotes.trim() || payment.notes,
          },
        });
        if (row.paymentNotes.trim()) {
          await prisma.pTSubscription.update({
            where: { id: sub.id },
            data: { notes: row.paymentNotes.trim() },
          });
        }
      }
      updated++;
    }
  }

  console.log(`\nDone. Updated ${updated}, skipped ${skipped}${dryRun ? " (dry run)" : ""}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
