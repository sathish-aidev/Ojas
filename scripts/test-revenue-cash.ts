/**
 * Manual Cult P&L: Received from Cult − TDS + Total PT − expenses − payroll
 *   npm run test:revenue-cash
 */
import {
  parseExpenseCategory,
  resolveCultPnlIncome,
  resolveGymPnl,
} from "../lib/revenue-constants";
import {
  clampToGymStart,
  GYM_START_MONTH,
  GYM_START_YEAR,
  isBeforeGymStart,
  monthsFromGymStartThrough,
} from "../lib/gym-calendar";

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
  console.log("\n=== Received from Cult − TDS (manual P&L) ===\n");

  const april = resolveCultPnlIncome({ partnerShare: 809198, tds: 15413 });
  assert(april.receivedFromCult === 809198, "Apr Received from Cult is Partner Share ₹8,09,198");
  assert(april.tds === 15413, "Apr TDS is ₹15,413");
  assert(april.amount === 809198 - 15413, "Apr Cult after TDS is Partner Share − TDS");
  assert(april.source === "partner_share", "Source is typed Partner Share");

  const feb = resolveCultPnlIncome({ partnerShare: 775772, tds: 14777 });
  assert(feb.amount === 775772 - 14777, "Feb ignores leasing EMI (Partner Share − TDS only)");
  assert(feb.amount !== 612238, "Feb is not the old cash-legs figure");

  const empty = resolveCultPnlIncome({ partnerShare: null, tds: null });
  assert(empty.amount === 0, "Blank Received and TDS count as 0");
  assert(empty.source === "none", "Empty month has no Cult source");
  assert(empty.receivedFromCult == null, "Blank Received displays as not entered");

  const receivedOnly = resolveCultPnlIncome({ partnerShare: 775772, tds: null });
  assert(receivedOnly.amount === 775772, "Missing TDS counts as 0");

  const noTaxInvoice = resolveCultPnlIncome({ partnerShare: null, tds: 15413 });
  assert(noTaxInvoice.amount === -15413, "TDS without Received still subtracts");
  assert(noTaxInvoice.source === "none", "No tax-invoice fallback when Received is empty");

  const gym = resolveGymPnl({
    receivedFromCult: 809198,
    tds: 15413,
    totalPt: 104075 + 96425,
    expenses: 0,
    payrollPaid: 0,
  });
  assert(gym.cultAfterTds === 809198 - 15413, "Gross Cult slice is Received − TDS");
  assert(gym.grossIncome === 809198 - 15413 + 200500, "Gross is Received − TDS + Total PT");
  assert(gym.netResult === gym.grossIncome, "Net matches gross when expenses and payroll are zero");

  const gymPaid = resolveGymPnl({
    receivedFromCult: 809198,
    tds: 15413,
    totalPt: 200500,
    expenses: 10000,
    payrollPaid: 96425 + 50000,
  });
  assert(
    gymPaid.netResult === 809198 - 15413 + 200500 - 10000 - 146425,
    "Net is Received from Cult − TDS + Total PT − expenses − payroll"
  );

  console.log("\n=== Gym calendar (Jan 2026 start) ===\n");
  assert(GYM_START_MONTH === 1 && GYM_START_YEAR === 2026, "Gym start is Jan 2026");
  assert(isBeforeGymStart(12, 2025), "Dec 2025 is before gym start");
  assert(!isBeforeGymStart(1, 2026), "Jan 2026 is gym start");
  const clamped = clampToGymStart(8, 2025);
  assert(clamped.month === 1 && clamped.year === 2026, "Months before start clamp to Jan 2026");
  const throughAug = monthsFromGymStartThrough(8, 2026);
  assert(throughAug.length === 8, "Aug 2026 trend is Jan–Aug (8 months)");
  assert(throughAug[0].month === 1 && throughAug[0].year === 2026, "Trend starts Jan 2026");
  assert(throughAug[7].month === 8 && throughAug[7].year === 2026, "Trend ends at selected month");
  assert(monthsFromGymStartThrough(12, 2025).length === 1, "Pre-start selection still yields Jan 2026");

  console.log("\n=== Expense category aliases ===\n");
  assert(parseExpenseCategory("TDS") === "TDS", "TDS");
  assert(parseExpenseCategory("GST") === "GST", "GST");
  assert(parseExpenseCategory("CA fee") === "CA_FEE", "CA fee");
  assert(parseExpenseCategory("CA fees") === "CA_FEE", "CA fees");

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main();
