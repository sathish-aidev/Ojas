/**
 * Unit tests for CSV import parsing helpers.
 * Run: npm run test:import-csv
 */
import { parseFlexibleDate, formatDateDMY } from "../lib/import/parse-csv-dates";
import { parseFeePaidOn } from "../lib/import/parse-fee-paid";
import { mapPaymentMode } from "../lib/import/map-payment-mode";
import { parseGymCsv } from "../lib/import/parse-gym-csv";

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

console.log("\n=== CSV Import Parser Tests ===\n");

console.log("1. parseFlexibleDate");
assert(parseFlexibleDate("9/2/2026")!.getDate() === 9, "9/2/2026 → day 9");
assert(parseFlexibleDate("27/1/2026")!.getMonth() === 0, "27/1/2026 → January");
assert(parseFlexibleDate("03/01/2026")!.getFullYear() === 2026, "03/01/2026 → year 2026");
assert(parseFlexibleDate("invalid") === null, "Invalid date returns null");

console.log("\n2. parseFeePaidOn");
const start = parseFlexibleDate("03/01/2026")!;
const fee1 = parseFeePaidOn("yes 01/05/2026", start);
assert(fee1.paymentDate.getDate() === 1 && fee1.paymentDate.getMonth() === 4, "Extracts date from 'yes 01/05/2026'");
const fee2 = parseFeePaidOn("yes", start);
assert(fee2.usedStartDateFallback && fee2.paymentDate.getTime() === start.getTime(), "Plain 'yes' uses start date");
const fee3 = parseFeePaidOn("advance payment yes 09/02/2026", start);
assert(fee3.paymentDate.getDate() === 9 && fee3.paymentDate.getMonth() === 1, "Advance payment with date");
const fee4 = parseFeePaidOn("29/06/2026", start);
assert(fee4.paymentDate.getDate() === 29 && fee4.paymentDate.getMonth() === 5, "Plain date in fee paid on");

console.log("\n3. mapPaymentMode");
assert(mapPaymentMode("phone pe to Sathish").mode === "UPI", "PhonePe → UPI");
assert(mapPaymentMode("cash given to lokesh").mode === "CASH", "Cash → CASH");
assert(mapPaymentMode("December month share only paid").mode === "OTHER", "Unknown → OTHER");

console.log("\n4. formatDateDMY");
assert(formatDateDMY(new Date(2026, 0, 3, 12)) === "03/01/2026", "Formats DD/MM/YYYY");

console.log("\n5. parseGymCsv (minimal fixture)");
const fixture = `Trainer,Customer,Start Date,End Date,Fee paid on ,Amount,Months,Mode of Payment
Sai,Dhaval,16/03/2026,16/05/2026,yes 09/03/2026,15000,2,phone pe to Sathish
,Test,01/01/2026,01/02/2026,yes,10000,1,UPI
`;
const result = parseGymCsv(fixture);
assert(result.errors.length === 0, "No parse errors");
assert(result.rows.length === 2, "Parses 2 data rows");
assert(result.rows[0].customer === "Dhaval", "First customer is Dhaval");
assert(result.rows[0].amount === 15000, "Dhaval amount = 15000");
assert(result.rows[0].monthsCount === 2, "Dhaval months = 2");

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
