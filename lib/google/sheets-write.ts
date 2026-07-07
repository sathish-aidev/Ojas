import { getSheetsClient } from "./sheets-client";
import { getSpreadsheetId } from "@/lib/sheet-config";

export async function writeSheetTab(
  tabName: string,
  rows: string[][]
): Promise<void> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const escaped = tabName.replace(/'/g, "''");
  const range = `'${escaped}'!A1`;

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${escaped}'!A:Z`,
  });

  if (rows.length === 0) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
}
