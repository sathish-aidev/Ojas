/**
 * Create Cult invoice Drive folders and seed the Expenses + Supervisor spends tabs.
 * Run: npx tsx scripts/init-revenue-resources.ts
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });

import { ensureCultInvoiceFolders } from "../lib/google/drive-archive";
import { ensureExpenseSheets, fetchAllExpenseSheetRows } from "../lib/google/expense-sheet";
import { getExpensesSpreadsheetId, EXPENSES_TAB_NAME, SUPERVISOR_SPENDS_TAB_NAME } from "../lib/sheet-config";

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

  console.log("\nEnsuring expense sheets…");
  try {
    const tabs = await ensureExpenseSheets();
    const spreadsheetId = getExpensesSpreadsheetId();
    console.log(`  Spreadsheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
    console.log(`  Tab: ${EXPENSES_TAB_NAME} (sheetId ${tabs.ownerSheetId})`);
    console.log(`  Tab: ${SUPERVISOR_SPENDS_TAB_NAME} (sheetId ${tabs.supervisorSheetId})`);
    const fetched = await fetchAllExpenseSheetRows();
    for (const tab of fetched) {
      const header = tab.rows[1]?.join(" | ") ?? "(missing)";
      console.log(`  ${tab.title} headers: ${header}`);
    }
  } catch (err) {
    console.error("Expense sheets failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
