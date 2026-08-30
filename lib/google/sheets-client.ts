import { google } from "googleapis";
import { getGoogleAuth, ALL_GOOGLE_SCOPES } from "./google-auth";
import { getSpreadsheetId } from "@/lib/sheet-config";
import { padValuesToA1 } from "./sheet-grid";
import { formatTrainerSheetDateCells } from "@/lib/import/parse-gym-sheet";

export async function getSheetsClient() {
  const auth = getGoogleAuth(ALL_GOOGLE_SCOPES);
  return google.sheets({ version: "v4", auth });
}

export async function fetchSheetTab(tabName: string): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const range = `'${tabName.replace(/'/g, "''")}'!A:Z`;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const padded = padValuesToA1((res.data.values as unknown[][]) ?? [], res.data.range);
  return formatTrainerSheetDateCells(padded);
}

export async function listSpreadsheetTabs(): Promise<string[]> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  return (
    res.data.sheets
      ?.map((s) => s.properties?.title)
      .filter((t): t is string => !!t) ?? []
  );
}
