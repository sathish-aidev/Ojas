/**
 * Expense sheet grid helpers — Tables starting at B3, DD/MM/YYYY dates.
 * Run: npm run test:expense-sheet
 */
import { parseA1RangeStart, padValuesToA1 } from "../lib/google/sheet-grid";
import { formatDateDMY, parseSheetDate } from "../lib/import/parse-csv-dates";

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

console.log("\n=== Expense sheet grid / dates ===\n");

console.log("1. parseA1RangeStart");
assert(parseA1RangeStart("'Expenses'!B3:I20").row === 3, "B3 row is 3");
assert(parseA1RangeStart("'Expenses'!B3:I20").col === 2, "B is column 2");
assert(parseA1RangeStart("A1:I10").row === 1 && parseA1RangeStart("A1:I10").col === 1, "A1 is row 1 col 1");
assert(parseA1RangeStart("'Supervisor spends'!C5:J40").col === 3, "C is column 3");

console.log("\n2. padValuesToA1 for a Table at B3");
const padded = padValuesToA1(
  [
    ["Date", "Type", "Category", "Description", "Amount", "Payment Mode", "Paid By", "Notes"],
    ["04/01/2026", "Owner bill", "Supplies", "DMart", 1500, "UPI", "", ""],
  ],
  "'Expenses'!B3:I5"
);
assert(padded.length === 4, "Two leading rows padded so data starts at sheet row 3");
assert(padded[0].length === 0 && padded[1].length === 0, "Rows 1–2 empty");
assert(padded[2][0] === "" && padded[2][1] === "Date", "Header Date is column B (index 1)");
assert(padded[3][1] === "04/01/2026", "First data date is in column B");
assert(padded[3][5] === "1500", "Amount stringified");

console.log("\n3. DD/MM/YYYY round-trip");
const parsed = parseSheetDate(padded[3][1])!;
assert(parsed.getDate() === 4 && parsed.getMonth() === 0, "04/01/2026 is 4 January");
assert(formatDateDMY(parsed) === "04/01/2026", "Write-back stays DD/MM/YYYY");

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
