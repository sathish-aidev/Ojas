/**
 * Recalculate payment splits for a trainer across every month that has payments.
 * Usage: npx tsx scripts/recalculate-trainer-splits.ts Rahul
 */
import { PrismaClient } from "@prisma/client";
import { recalculateTrainerMonthSplits, getPaymentCollectionDate } from "../lib/services/trainer-split";

const prisma = new PrismaClient();

async function main() {
  const trainerName = process.argv[2];
  if (!trainerName) {
    console.error("Usage: npx tsx scripts/recalculate-trainer-splits.ts <TrainerName>");
    process.exit(1);
  }

  const trainer = await prisma.employee.findFirst({
    where: { employeeType: "TRAINER", user: { name: trainerName } },
    include: { user: true },
  });

  if (!trainer) {
    console.error(`Trainer "${trainerName}" not found`);
    process.exit(1);
  }

  const payments = await prisma.payment.findMany({
    where: { subscription: { client: { trainerId: trainer.id } } },
    select: { paidAt: true, collectedAt: true },
  });

  const monthKeys = new Map<string, { month: number; year: number }>();
  for (const p of payments) {
    const collected = getPaymentCollectionDate(p);
    const collKey = `${collected.getFullYear()}-${collected.getMonth() + 1}`;
    monthKeys.set(collKey, {
      month: collected.getMonth() + 1,
      year: collected.getFullYear(),
    });
    const svcKey = `${p.paidAt.getFullYear()}-${p.paidAt.getMonth() + 1}`;
    monthKeys.set(svcKey, {
      month: p.paidAt.getMonth() + 1,
      year: p.paidAt.getFullYear(),
    });
  }

  const sorted = [...monthKeys.values()].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  );

  console.log(`Recalculating ${sorted.length} months for ${trainer.user.name}...`);

  for (const { month, year } of sorted) {
    const result = await recalculateTrainerMonthSplits(trainer.id, month, year);
    console.log(
      `  ${month}/${year}: ${result?.splitPercent ?? 0}% split, revenue ₹${result?.monthlyRevenue ?? 0}`
    );
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
