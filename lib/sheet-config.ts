/** Google Sheet tab names — must match trainer User.name (case-insensitive). */
export const TRAINER_SHEET_TABS = ["Rohith", "Sai Karan", "Rahul"] as const;

export const PT_SPREADSHEET_NAME = "Ojas PT Tracker";
export const REPORTS_FOLDER_NAME = "Reports";
export const WEEKLY_BACKUPS_FOLDER = "Backups";

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
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  if (!id) throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not configured");
  return id;
}

export function getDriveFolderId(): string {
  return (
    process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() ||
    "1Jb8g5gFUdiIdBEwHMaOEDLetK0GK9FHN"
  );
}

export function getOwnerReportEmail(): string {
  return process.env.OWNER_REPORT_EMAIL?.trim() || "sparkversefitness@gmail.com";
}
