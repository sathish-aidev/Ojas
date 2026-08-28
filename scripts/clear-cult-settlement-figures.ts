/**
 * Clear Cult Partner Share, TDS, and other parsed money fields.
 * Drive URLs and notes stay. P&L amounts are entered by hand after this.
 *
 *   npx tsx scripts/clear-cult-settlement-figures.ts
 *   npx tsx scripts/clear-cult-settlement-figures.ts --apply
 *   npx tsx scripts/clear-cult-settlement-figures.ts --prod --apply
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
    const rows = await prisma.cultSettlement.findMany({
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });
    console.log(`${rows.length} Cult settlement row(s)${prod ? " (production)" : " (local)"}:`);
    for (const row of rows) {
      console.log(
        `  ${String(row.month).padStart(2, "0")}/${row.year} partnerShare=${
          row.partnerShare == null ? "null" : decimalToNumber(row.partnerShare)
        } tds=${row.tds == null ? "null" : decimalToNumber(row.tds)} urls=${
          row.settlementDriveUrl || row.taxInvoiceDriveUrl ? "yes" : "no"
        }`
      );
    }

    if (!apply) {
      console.log("\nDry run. Pass --apply to clear money fields (URLs stay).");
      return;
    }

    const result = await prisma.cultSettlement.updateMany({
      data: {
        partnerShare: null,
        taxInvoiceGrossTotal: null,
        saleOfNewPacks: null,
        walkInsOuts: null,
        otherAdjustments: null,
        platformFees: null,
        totalRevenue: null,
        cmCharges: null,
        maintInfraCharges: null,
        centerCollections: null,
        midMonthPayment: null,
        tds: null,
        leasingEmi: null,
        grossPayable: null,
      },
    });
    console.log(`\nCleared money fields on ${result.count} row(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
