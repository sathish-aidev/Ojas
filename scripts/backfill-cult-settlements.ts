/**
 * Validate local Cult Mnt End PDFs (parser check only).
 * P&L figures are entered by hand — this script does not write Partner Share or TDS.
 *
 *   npx tsx scripts/backfill-cult-settlements.ts
 */
import { config } from "dotenv";
import { readdir, readFile } from "fs/promises";
import path from "path";

config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { extractText, getDocumentProxy } from "unpdf";
import { parseCultPdfText, validateCultSettlementParse } from "../lib/cult-pdf-parse";
import { classifyCultInvoiceName } from "../lib/cult-invoice-parse";
import { decimalToNumber } from "../lib/utils";

const DEFAULT_FOLDER =
  "c:\\Users\\SATHISH\\OneDrive\\Documents\\SparkverseFitness_Documents\\cult_Invoices_2026\\Settlement";

const JAN_2026 = {
  partnerShare: 674437,
  totalRevenue: 874968,
  grossPayable: 413554,
  leasingEmi: 148757,
};

const apply = process.argv.includes("--apply");

async function parsePdfFile(filePath: string) {
  const buf = await readFile(filePath);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const extracted = await extractText(pdf, { mergePages: true });
  const text = Array.isArray(extracted.text) ? extracted.text.join("\n") : extracted.text;
  return parseCultPdfText(text ?? "");
}

async function main() {
  const folder = process.env.CULT_PDF_FOLDER || DEFAULT_FOLDER;
  const names = (await readdir(folder)).filter((n) => n.toLowerCase().endsWith(".pdf"));
  const prisma = new PrismaClient();

  try {
    const gym = await prisma.gym.findFirst({ orderBy: { createdAt: "asc" } });
    if (!gym) throw new Error("Gym not found");

    const existing = await prisma.cultSettlement.findMany({
      where: { gymId: gym.id },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });
    console.log("Existing Cult rows:");
    for (const row of existing) {
      console.log(
        `  ${String(row.month).padStart(2, "0")}/${row.year} partnerShare=${
          row.partnerShare == null ? "null" : decimalToNumber(row.partnerShare)
        } taxUrl=${row.taxInvoiceDriveUrl ? "yes" : "no"} settlementUrl=${
          row.settlementDriveUrl ? "yes" : "no"
        }`
      );
    }

    const settlements = names.filter((n) => classifyCultInvoiceName(n) === "settlement");
    console.log(`\nValidating ${settlements.length} Mnt End PDF(s) in ${folder}`);

    let janOk = false;
    const ready: Array<{
      name: string;
      month: number;
      year: number;
      parsed: ReturnType<typeof parseCultPdfText>;
    }> = [];

    for (const name of settlements.sort()) {
      const parsed = await parsePdfFile(path.join(folder, name));
      const check = validateCultSettlementParse(parsed);
      const line = `${name}: partnerShare=${parsed.partnerShare} totalRevenue=${parsed.totalRevenue} grossPayable=${parsed.grossPayable} period=${parsed.periodStart} -> ${parsed.periodEnd}`;
      if (!check.ok) {
        console.log(`  FAIL ${line} | ${check.errors.join("; ")}`);
        continue;
      }
      console.log(`  OK   ${line}`);
      if (check.month === 1 && check.year === 2026) {
        if (
          parsed.partnerShare !== JAN_2026.partnerShare ||
          parsed.totalRevenue !== JAN_2026.totalRevenue ||
          parsed.grossPayable !== JAN_2026.grossPayable ||
          parsed.leasingEmi !== JAN_2026.leasingEmi
        ) {
          throw new Error(
            `January PDF did not match expected Partner Share ${JAN_2026.partnerShare}, Total Revenue ${JAN_2026.totalRevenue}, Gross Payable ${JAN_2026.grossPayable}`
          );
        }
        janOk = true;
      }
      ready.push({ name, month: check.month!, year: check.year!, parsed });
    }

    if (!janOk) {
      throw new Error("January 2026 Mnt End PDF failed validation; refusing to write");
    }

    if (apply) {
      console.log("\nP&L figures are entered by hand. --apply no longer writes Partner Share or TDS.");
      return;
    }

    console.log("\nParser check only. P&L amounts are typed on Monthly revenue.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
