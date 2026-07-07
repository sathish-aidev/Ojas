import { google } from "googleapis";
import { getGoogleAuth, ALL_GOOGLE_SCOPES } from "./google-auth";
import { getSpreadsheetId } from "@/lib/sheet-config";

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

  return (res.data.values as string[][]) ?? [];
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
