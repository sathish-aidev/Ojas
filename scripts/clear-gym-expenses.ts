/**
 * Delete all GymExpense rows so "Sync from expense sheet" can load the sheet as the source.
 * Does not touch Cult settlements, payroll, clients, or the Google Sheet.
 *
 *   npx tsx scripts/clear-gym-expenses.ts
 *   npx tsx scripts/clear-gym-expenses.ts --apply
 *   npx tsx scripts/clear-gym-expenses.ts --prod --apply
 */
import { config } from "dotenv";

const prod = process.argv.includes("--prod");
config({ path: prod ? ".env.vercel.production" : ".env", override: prod });

import { PrismaClient } from "@prisma/client";
import { decimalToNumber } from "../lib/utils";

const apply = process.argv.includes("--apply");

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.gymExpense.findMany({
      orderBy: [{ year: "asc" }, { month: "asc" }, { date: "asc" }],
    });
    const byKind = new Map<string, { count: number; amount: number }>();
    for (const row of rows) {
      const current = byKind.get(row.kind) ?? { count: 0, amount: 0 };
      current.count += 1;
      current.amount += decimalToNumber(row.amount);
      byKind.set(row.kind, current);
    }

    console.log(`${rows.length} gym expense row(s)${prod ? " (production)" : " (local)"}:`);
    for (const [kind, stats] of [...byKind.entries()].sort()) {
      console.log(`  ${kind}: ${stats.count} row(s), ₹${stats.amount.toFixed(2)}`);
    }

    if (!apply) {
      console.log("\nDry run. Pass --apply to delete these rows. Google Sheets are not changed.");
      return;
    }

    const result = await prisma.gymExpense.deleteMany({});
    console.log(`\nDeleted ${result.count} gym expense row(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
