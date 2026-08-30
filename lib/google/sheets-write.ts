import { getSheetsClient } from "./sheets-client";
import { getSpreadsheetId } from "@/lib/sheet-config";

type SheetTable = { tableId?: string | null };

/**
 * Convert a Google Sheets Table back into a normal range.
 * Tables treat the first data row as a frozen header (nisha&agra / Pooja / srikar),
 * so that client is skipped or pinned and amounts show as "# 15000".
 */
export async function flattenTrainerTabTables(tabName: string): Promise<number> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title),sheets.tables",
  });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === tabName);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId == null) return 0;

  const tables = ((sheet as { tables?: SheetTable[] }).tables ?? []).filter(
    (t): t is { tableId: string } => !!t.tableId
  );
  const requests: object[] = tables.map((t) => ({ deleteTable: { tableId: t.tableId } }));
  requests.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { frozenRowCount: 2 } },
      fields: "gridProperties.frozenRowCount",
    },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
  return tables.length;
}

export async function writeSheetTab(
  tabName: string,
  rows: string[][]
): Promise<void> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const escaped = tabName.replace(/'/g, "''");
  const range = `'${escaped}'!A1`;

  await flattenTrainerTabTables(tabName);

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${escaped}'!A:Z`,
  });

  if (rows.length === 0) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
}
