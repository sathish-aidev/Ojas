/**
 * Create Cult invoice Drive folders and the Expenses Google Sheet tab.
 * Run: npx tsx scripts/init-revenue-resources.ts
 */
import { ensureCultInvoiceFolders } from "../lib/google/drive-archive";
import { ensureExpensesTab } from "../lib/google/expense-sheet";
import { getExpensesSpreadsheetId } from "../lib/sheet-config";

async function main() {
  console.log("Creating Cult invoice folders…");
  try {
    const folders = await ensureCultInvoiceFolders();
    console.log("  Cult invoices:", folders.cultInvoicesUrl);
    console.log("  Settlement statements:", folders.settlementUrl);
    console.log("  Tax invoices:", folders.taxInvoiceUrl);
  } catch (err) {
    console.error("Drive folders failed:", err instanceof Error ? err.message : err);
  }

  console.log("\nEnsuring Expenses tab…");
  try {
    const tab = await ensureExpensesTab();
    const spreadsheetId = getExpensesSpreadsheetId();
    console.log(`  Spreadsheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
    console.log(`  Tab: Expenses (sheetId ${tab.sheetId})`);
  } catch (err) {
    console.error("Expenses tab failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
