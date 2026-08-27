/**
 * Cult cash received vs RDS — run after revenue cash changes:
 *   npm run test:revenue-cash
 */
import { parseExpenseCategory, resolveCultCashReceived } from "../lib/revenue-constants";

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

function main() {
  console.log("\n=== Cult cash received / RDS ===\n");

  const april = resolveCultCashReceived({
    centerCollections: 164300,
    midMonthPayment: 382316,
    grossPayable: 247169,
    partnerShare: 809198,
    tds: 15413,
  });
  assert(april.moneyReceived === 793785, "Apr 2026 actual money received is ₹7,93,785");
  assert(april.rds === 15413, "Apr 2026 RDS is ₹15,413");
  assert(april.source === "cash_legs", "Prefers centre + mid-month + gross payable");
  assert(april.moneyReceived !== 809198, "RDS is not added to money received");
  assert(april.moneyReceived !== 809198 + 15413, "RDS is not added to Partner Share");

  const fromShare = resolveCultCashReceived({
    centerCollections: null,
    midMonthPayment: null,
    grossPayable: null,
    partnerShare: 809198,
    tds: 15413,
  });
  assert(fromShare.moneyReceived === 793785, "Falls back to Partner Share minus RDS");
  assert(fromShare.source === "partner_share_minus_rds", "Fallback source is partner share minus RDS");

  const none = resolveCultCashReceived({
    centerCollections: null,
    midMonthPayment: null,
    grossPayable: null,
    partnerShare: 809198,
    tds: null,
  });
  assert(none.moneyReceived === null, "Money received is unknown without RDS or cash legs");
  assert(none.rds === null, "RDS empty when TDS is not entered");

  console.log("\n=== Expense category aliases ===\n");
  assert(parseExpenseCategory("TDS") === "TDS", "TDS");
  assert(parseExpenseCategory("GST") === "GST", "GST");
  assert(parseExpenseCategory("CA fee") === "CA_FEE", "CA fee");
  assert(parseExpenseCategory("CA fees") === "CA_FEE", "CA fees");

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main();
