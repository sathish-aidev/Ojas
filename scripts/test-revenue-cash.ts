/**
 * Cult cash received vs TDS — run after revenue cash changes:
 *   npm run test:revenue-cash
 */
import {
  parseExpenseCategory,
  resolveCultCashReceived,
  resolveCultPnlIncome,
  resolveGymPnl,
} from "../lib/revenue-constants";

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
  console.log("\n=== Cult cash received / TDS ===\n");

  const april = resolveCultCashReceived({
    centerCollections: 164300,
    midMonthPayment: 382316,
    grossPayable: 247169,
    partnerShare: 809198,
    tds: 15413,
  });
  assert(april.moneyReceived === 793785, "Apr 2026 actual money received is ₹7,93,785");
  assert(april.rds === 15413, "Apr 2026 TDS is ₹15,413");
  assert(april.source === "cash_legs", "Prefers centre + mid-month + gross payable");
  assert(april.moneyReceived !== 809198, "TDS is not added to money received");
  assert(april.moneyReceived !== 809198 + 15413, "TDS is not added to Partner Share");

  const fromShare = resolveCultCashReceived({
    centerCollections: null,
    midMonthPayment: null,
    grossPayable: null,
    partnerShare: 809198,
    tds: 15413,
  });
  assert(fromShare.moneyReceived === 793785, "Falls back to Partner Share minus TDS");
  assert(fromShare.source === "partner_share_minus_rds", "Fallback source is partner share minus TDS");

  const signedLegs = resolveCultCashReceived({
    centerCollections: -164300,
    midMonthPayment: -382316,
    grossPayable: 247169,
    partnerShare: 809198,
    tds: -15413,
  });
  assert(signedLegs.moneyReceived === 793785, "PDF minus signs on cash legs are treated as money in");
  assert(signedLegs.rds === 15413, "TDS amount is shown as a positive withheld figure");

  const pnl = resolveCultPnlIncome({
    centerCollections: 164300,
    midMonthPayment: 382316,
    grossPayable: 247169,
    partnerShare: 809198,
    taxInvoiceGrossTotal: null,
    tds: 15413,
  });
  assert(pnl.amount === 793785, "P&L Cult income is actual money received, not Partner Share");
  assert(pnl.usedMoneyReceived, "P&L uses money received when known");
  assert(pnl.amount !== 809198, "Partner Share is not used as P&L Cult income when TDS is known");

  const none = resolveCultCashReceived({
    centerCollections: null,
    midMonthPayment: null,
    grossPayable: null,
    partnerShare: 809198,
    tds: null,
  });
  assert(none.moneyReceived === null, "Money received is unknown without TDS or cash legs");
  assert(none.rds === null, "TDS empty when not entered");

  const gym = resolveGymPnl({
    cultIncome: 793785,
    totalPt: 104075 + 96425,
    expenses: 0,
    payrollPaid: 0,
  });
  assert(gym.grossIncome === 994285, "Gross is Cult received + Total PT");
  assert(gym.netResult === 994285, "Net matches gross when expenses and payroll are zero");
  const gymPaid = resolveGymPnl({
    cultIncome: 793785,
    totalPt: 200500,
    expenses: 10000,
    payrollPaid: 96425 + 50000,
  });
  assert(
    gymPaid.netResult === 793785 + 200500 - 10000 - 146425,
    "Net is Cult + Total PT − expenses − payroll (base + trainer PT share)"
  );

  console.log("\n=== Expense category aliases ===\n");
  assert(parseExpenseCategory("TDS") === "TDS", "TDS");
  assert(parseExpenseCategory("GST") === "GST", "GST");
  assert(parseExpenseCategory("CA fee") === "CA_FEE", "CA fee");
  assert(parseExpenseCategory("CA fees") === "CA_FEE", "CA fees");

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main();
