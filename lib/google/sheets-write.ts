import { getSheetsClient } from "./sheets-client";
import { getSpreadsheetId } from "@/lib/sheet-config";
import { padValuesToA1 } from "./sheet-grid";
import { realignTrainerSheetRows } from "@/lib/import/parse-gym-sheet";

type SheetTable = { tableId?: string | null };

const TITLE_COLS = 9;

function toStringGrid(rows: unknown[][]): string[][] {
  return rows.map((row) => (row ?? []).map((cell) => (cell == null ? "" : String(cell))));
}

export async function applyTrainerTabChrome(tabName: string): Promise<void> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const sheetId = meta.data.sheets?.find((s) => s.properties?.title === tabName)?.properties?.sheetId;
  if (sheetId == null) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 2 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 200,
              startColumnIndex: 0,
              endColumnIndex: TITLE_COLS,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 1, blue: 1 },
                textFormat: {
                  foregroundColor: { red: 0.15, green: 0.15, blue: 0.15 },
                  bold: false,
                  fontSize: 10,
                },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: TITLE_COLS,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 1, blue: 1 },
                textFormat: {
                  foregroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                  bold: false,
                  fontSize: 11,
                },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 1,
              endRowIndex: 2,
              startColumnIndex: 0,
              endColumnIndex: TITLE_COLS,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.93, green: 0.93, blue: 0.93 },
                textFormat: {
                  foregroundColor: { red: 0.1, green: 0.1, blue: 0.1 },
                  bold: true,
                  fontSize: 10,
                },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        },
      ],
    },
  });
}

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
  if (tables.length === 0) return 0;

  const escaped = tabName.replace(/'/g, "''");
  let saved: string[][] = [];
  if (tables.length > 0) {
    const valuesRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${escaped}'!A:Z`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    saved = padValuesToA1((valuesRes.data.values as unknown[][]) ?? [], valuesRes.data.range);
  }

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

  // deleteTable also wipes cell values. Put the rows back as title / headers / clients.
  if (saved.length > 0) {
    const aligned = realignTrainerSheetRows(toStringGrid(saved), tabName);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${escaped}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: aligned },
    });
    await applyTrainerTabChrome(tabName);
  }
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
  await applyTrainerTabChrome(tabName);
}
