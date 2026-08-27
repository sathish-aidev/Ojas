/**
 * Cult Mnt End PDF line parser — run after parse changes:
 *   npm run test:cult-pdf
 */
import { readdir, readFile } from "fs/promises";
import path from "path";
import { extractText, getDocumentProxy } from "unpdf";
import { lastMoneyOnLine, parseCultPdfText, validateCultSettlementParse } from "../lib/cult-pdf-parse";
import { classifyCultInvoiceName } from "../lib/cult-invoice-parse";
import { resolveCultCashReceived } from "../lib/revenue-constants";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

const JAN = `
3a Amount Payable to Gym Partner (Partner Share) 6,74,437
3b Less: Amount Collected At the center -99,280
3c Less: Mid-Month Payment -
3d Less: Expected TDS @ 2% -12,846
3e -
3f Less: Leasing EMI -1,48,757
3 Gross Payable 4,13,554
From: 01-January-2026 To: 31-January-2026
1 Total Revenue 8,74,968
`;

const FEB = `
3a Amount Payable to Gym Partner (Partner Share) 7,75,772
3b Less: Amount Collected At the center -2,55,460
3c Less: Mid-Month Payment -2,84,789
3d Less: Expected TDS @ 2% -14,777
3e -
3f Less: Leasing EMI -1,48,757
3 Gross Payable 71,989
From: 01-February-2026 To: 28-February-2026
1 Total Revenue 10,40,385
`;

const APR = `
3a Amount Payable to Gym Partner (Partner Share) 8,09,198
3b Less: Amount Collected At the center -1,64,300
3c Less: Mid-Month Payment -3,82,316
3d Less: Expected TDS @ 2% -15,413
3e -
3f -
3 Gross Payable 2,47,169
From: 01-April-2026 To: 30-April-2026
1 Total Revenue 11,09,487
`;

const SETTLEMENT_DIR =
  "c:\\Users\\SATHISH\\OneDrive\\Documents\\SparkverseFitness_Documents\\cult_Invoices_2026\\Settlement";

/** Partner Share, TDS, EMI, Cult received — from the 2026 Mnt End PDFs. */
const EXPECTED_2026: Record<number, { share: number; tds: number; emi: number; cash: number }> = {
  1: { share: 674437, tds: 12846, emi: 148757, cash: 512834 },
  2: { share: 775772, tds: 14777, emi: 148757, cash: 612238 },
  4: { share: 809198, tds: 15413, emi: 0, cash: 793785 },
  5: { share: 661189, tds: 12594, emi: 0, cash: 648595 },
  6: { share: 755011, tds: 14381, emi: 0, cash: 740631 },
  7: { share: 731554, tds: 13934, emi: 0, cash: 717620 },
};

async function parsePdfFile(filePath: string) {
  const buf = await readFile(filePath);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const extracted = await extractText(pdf, { mergePages: true });
  const text = Array.isArray(extracted.text) ? extracted.text.join("\n") : extracted.text;
  return parseCultPdfText(text ?? "");
}

async function assertRealSettlementPdfs() {
  let names: string[];
  try {
    names = (await readdir(SETTLEMENT_DIR)).filter((n) => n.toLowerCase().endsWith(".pdf"));
  } catch {
    console.log("\n=== Real Mnt End PDFs ===\n  (folder not found — skipped)\n");
    return;
  }
  const settlements = names.filter((n) => classifyCultInvoiceName(n) === "settlement");
  console.log(`\n=== Real Mnt End PDFs (${settlements.length}) ===\n`);
  for (const name of settlements.sort()) {
    const parsed = await parsePdfFile(path.join(SETTLEMENT_DIR, name));
    const check = validateCultSettlementParse(parsed);
    const cash = resolveCultCashReceived(parsed);
    assert(check.ok, `${name} validates`);
    if (!check.month || check.year !== 2026) continue;
    const expected = EXPECTED_2026[check.month];
    if (!expected) {
      console.log(`  · ${name}: no fixture for month ${check.month} (cash=${cash.moneyReceived})`);
      continue;
    }
    assert(parsed.partnerShare === expected.share, `${name} Partner Share ${expected.share}`);
    assert(parsed.tds === expected.tds, `${name} TDS ${expected.tds}`);
    assert((parsed.leasingEmi ?? 0) === expected.emi, `${name} leasing EMI ${expected.emi}`);
    assert(cash.moneyReceived === expected.cash, `${name} Cult received ${expected.cash}`);
  }
}

async function main() {
  console.log("\n=== Cult PDF line amounts ===\n");
  assert(lastMoneyOnLine("3c Less: Mid-Month Payment -") === 0, "Blank Less: line is 0");
  assert(lastMoneyOnLine("3f Less: Leasing EMI -1,48,757") === 148757, "Leasing EMI amount");
  assert(lastMoneyOnLine("3d Less: Expected TDS @ 2% -12,846") === 12846, "TDS ignores 2%");

  console.log("\n=== January / February / April fixtures ===\n");
  const jan = parseCultPdfText(JAN);
  assert(jan.partnerShare === 674437, "Jan Partner Share");
  assert(jan.midMonthPayment === 0, "Jan mid-month blank");
  assert(jan.leasingEmi === 148757, "Jan leasing EMI");
  assert(jan.grossPayable === 413554, "Jan Gross Payable");
  assert(jan.periodStart === "2026-01-01", "Jan period");
  const janCash = resolveCultCashReceived(jan);
  assert(janCash.moneyReceived === 512834, "Jan Cult received ₹5,12,834");

  const feb = parseCultPdfText(FEB);
  assert(feb.partnerShare === 775772, "Feb Partner Share");
  assert(feb.leasingEmi === 148757, "Feb leasing EMI");
  assert(feb.grossPayable === 71989, "Feb Gross Payable");
  const febCash = resolveCultCashReceived(feb);
  assert(febCash.moneyReceived === 612238, "Feb Cult received ₹6,12,238");

  const apr = parseCultPdfText(APR);
  assert(apr.partnerShare === 809198, "Apr Partner Share");
  assert(!apr.leasingEmi, "Apr has no leasing EMI line");
  const aprCash = resolveCultCashReceived(apr);
  assert(aprCash.moneyReceived === 793785, "Apr Cult received ₹7,93,785");

  await assertRealSettlementPdfs();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
