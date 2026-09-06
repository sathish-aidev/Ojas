import { cleanEnv } from "@/lib/env";
import { isProductionApp } from "@/lib/app-env";
import { assertGoogleIdAllowed } from "@/lib/google/production-google-ids";

/** Google Sheet tab names — must match trainer User.name (case-insensitive). */
export const TRAINER_SHEET_TABS = ["Rohith", "Sai Karan", "Rahul"] as const;

export const PT_SPREADSHEET_NAME = "Impackt Fitness PT Tracker";
export const REPORTS_FOLDER_NAME = "Reports";
export const WEEKLY_BACKUPS_FOLDER = "Backups";
export const BACKUP_TAB_PREFIX = "Backup ";
export const EXPENSES_TAB_NAME = "Expenses";
export const SUPERVISOR_SPENDS_TAB_NAME = "Supervisor spends";
export const EXPENSES_SPREADSHEET_NAME = "Impackt Fitness Expenses";
export const CULT_INVOICES_FOLDER = "Cult_Invoices";
export const CULT_SETTLEMENT_FOLDER = "Settlement_Statements";
export const CULT_TAX_INVOICE_FOLDER = "Tax_Invoices";

export const EXPENSE_SHEET_HEADERS = [
  "Id",
  "Date",
  "Type",
  "Category",
  "Description",
  "Amount",
  "Payment Mode",
  "Paid By",
  "Notes",
] as const;

export const SUPERVISOR_SPEND_SHEET_HEADERS = [
  "Id",
  "Date",
  "Category",
  "Description",
  "Amount",
  "Payment Mode",
  "Paid By",
  "Notes",
] as const;

export const SHEET_HEADERS = [
  "Customer",
  "Start Date",
  "End Date",
  "Fee paid on",
  "Amount",
  "Months",
  "Mode of Payment",
  "Phone",
  "Notes",
] as const;

export function getSpreadsheetId(): string {
  const id = cleanEnv(process.env.GOOGLE_SHEETS_SPREADSHEET_ID);
  if (!id) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not configured");
  assertGoogleIdAllowed("spreadsheet", id);
  return id;
}

/** Optional user-owned spreadsheet for weekly tab copies (avoids SA Drive quota). */
export function getBackupSpreadsheetId(): string | undefined {
  const id = cleanEnv(process.env.GOOGLE_BACKUP_SPREADSHEET_ID);
  if (id) assertGoogleIdAllowed("backup spreadsheet", id);
  return id;
}

/** Expenses live on the PT tracker by default; override with a dedicated sheet if needed. */
export function getExpensesSpreadsheetId(): string {
  const override = cleanEnv(process.env.GOOGLE_EXPENSES_SPREADSHEET_ID);
  if (override) {
    assertGoogleIdAllowed("expenses spreadsheet", override);
    return override;
  }
  return getSpreadsheetId();
}

export function getDriveFolderId(): string {
  const id = cleanEnv(process.env.GOOGLE_DRIVE_FOLDER_ID);
  if (!id) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID is not configured");
  }
  assertGoogleIdAllowed("Drive folder", id);
  return id;
}

export function getOwnerReportEmail(): string {
  const configured = cleanEnv(process.env.OWNER_REPORT_EMAIL);
  if (configured) return configured;
  if (!isProductionApp()) return "";
  return "sparkversefitness@gmail.com";
}
