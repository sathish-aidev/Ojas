import { cleanEnv } from "@/lib/env";

/** Google Sheet tab names — must match trainer User.name (case-insensitive). */
export const TRAINER_SHEET_TABS = ["Rohith", "Sai Karan", "Rahul"] as const;

export const PT_SPREADSHEET_NAME = "Impackt Fitness PT Tracker";
export const REPORTS_FOLDER_NAME = "Reports";
export const WEEKLY_BACKUPS_FOLDER = "Backups";
export const BACKUP_TAB_PREFIX = "Backup ";
export const EXPENSES_TAB_NAME = "Expenses";
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
  return id;
}

/** Optional user-owned spreadsheet for weekly tab copies (avoids SA Drive quota). */
export function getBackupSpreadsheetId(): string | undefined {
  return cleanEnv(process.env.GOOGLE_BACKUP_SPREADSHEET_ID);
}

/** Expenses live on the PT tracker by default; override with a dedicated sheet if needed. */
export function getExpensesSpreadsheetId(): string {
  return cleanEnv(process.env.GOOGLE_EXPENSES_SPREADSHEET_ID) || getSpreadsheetId();
}

export function getDriveFolderId(): string {
  return (
    cleanEnv(process.env.GOOGLE_DRIVE_FOLDER_ID) ||
    "1Jb8g5gFUdiIdBEwHMaOEDLetK0GK9FHN"
  );
}

export function getOwnerReportEmail(): string {
  return cleanEnv(process.env.OWNER_REPORT_EMAIL) || "sparkversefitness@gmail.com";
}
