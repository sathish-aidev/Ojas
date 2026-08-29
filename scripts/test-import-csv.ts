/**
 * Unit tests for CSV import parsing helpers.
 * Run: npm run test:import-csv
 */
import { parseFlexibleDate, formatDateDMY, parseSheetDate, googleSerialToDate } from "../lib/import/parse-csv-dates";
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
assert(parseFlexibleDate("04/01/2026")!.getDate() === 4 && parseFlexibleDate("04/01/2026")!.getMonth() === 0, "04/01/2026 → 4 January (DD/MM/YYYY)");
assert(parseFlexibleDate("01/04/2026")!.getDate() === 1 && parseFlexibleDate("01/04/2026")!.getMonth() === 3, "01/04/2026 → 1 April (DD/MM/YYYY)");
assert(parseFlexibleDate("invalid") === null, "Invalid date returns null");

console.log("\n1b. parseSheetDate (Sheets serial + ISO + DD/MM/YYYY)");
const jan4 = parseSheetDate("04/01/2026")!;
assert(jan4.getDate() === 4 && jan4.getMonth() === 0 && jan4.getFullYear() === 2026, "Text 04/01/2026 → 4 January 2026");
assert(parseSheetDate("2026-01-04")!.getDate() === 4, "ISO 2026-01-04 → day 4");
const serialJan4 = Date.UTC(2026, 0, 4) / 86400000 + 25569;
assert(googleSerialToDate(serialJan4)!.getDate() === 4, "Serial for 4 Jan 2026 → day 4");
assert(googleSerialToDate(serialJan4)!.getMonth() === 0, "Serial for 4 Jan 2026 → January");
assert(parseSheetDate(serialJan4)!.getDate() === 4, "Numeric serial → 4 January");
assert(parseSheetDate(String(Math.floor(serialJan4)))!.getMonth() === 0, "Serial string → January");
assert(parseSheetDate(1500) === null, "Small numbers are not treated as dates");

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
assert(formatDateDMY(new Date(2026, 0, 4, 12)) === "04/01/2026", "4 January is 04/01/2026 not 01/04/2026");

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
