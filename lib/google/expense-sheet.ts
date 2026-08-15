import { getSheetsClient } from "./sheets-client";
import {
  EXPENSES_TAB_NAME,
  EXPENSE_SHEET_HEADERS,
  getExpensesSpreadsheetId,
} from "@/lib/sheet-config";
import { EXPENSE_CATEGORY_LABELS, paymentModeLabel } from "@/lib/revenue-constants";
import type { ExpenseCategory, PaymentMode } from "@prisma/client";

export type ExpenseSheetRow = {
  id: string;
  dateLabel: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMode: PaymentMode | null;
  paidBy: string | null;
  notes: string | null;
};

function escapedTab() {
  return `'${EXPENSES_TAB_NAME.replace(/'/g, "''")}'`;
}

export async function ensureExpensesTab(): Promise<{ spreadsheetId: string; sheetId: number }> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getExpensesSpreadsheetId();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });

  const existing = meta.data.sheets?.find((s) => s.properties?.title === EXPENSES_TAB_NAME);
  if (existing?.properties?.sheetId != null) {
    return { spreadsheetId, sheetId: existing.properties.sheetId };
  }

  const added = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: EXPENSES_TAB_NAME },
          },
        },
      ],
    },
  });
  const sheetId = added.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (sheetId == null) throw new Error("Failed to create Expenses tab");

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${escapedTab()}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          "Impackt Fitness Expenses | Editable in app and sheet until historic months are complete | Dates: DD/MM/YYYY | Leave Id blank for new rows — sync fills it",
        ],
        [...EXPENSE_SHEET_HEADERS],
      ],
    },
  });

  return { spreadsheetId, sheetId };
}

export async function fetchExpenseSheetRows(): Promise<string[][]> {
  const { spreadsheetId } = await ensureExpensesTab();
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapedTab()}!A:H`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return (res.data.values as string[][]) ?? [];
}

function toSheetValues(row: ExpenseSheetRow): string[] {
  return [
    row.id,
    row.dateLabel,
    EXPENSE_CATEGORY_LABELS[row.category],
    row.description,
    String(row.amount),
    paymentModeLabel(row.paymentMode),
    row.paidBy ?? "",
    row.notes ?? "",
  ];
}

export async function rewriteExpenseSheet(rows: ExpenseSheetRow[]): Promise<void> {
  const { spreadsheetId } = await ensureExpensesTab();
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${escapedTab()}!A:H`,
  });
  const values = [
    [
      "Impackt Fitness Expenses | Editable in app and sheet until historic months are complete | Dates: DD/MM/YYYY | Leave Id blank for new rows — sync fills it",
    ],
    [...EXPENSE_SHEET_HEADERS],
    ...rows.map(toSheetValues),
  ];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${escapedTab()}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

function findDataRowIndex(values: string[][], id: string): number {
  return values.findIndex((row, idx) => idx >= 2 && (row[0] ?? "").trim() === id);
}

export async function upsertExpenseSheetRow(row: ExpenseSheetRow): Promise<void> {
  const { spreadsheetId } = await ensureExpensesTab();
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapedTab()}!A:H`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const values = (res.data.values as string[][]) ?? [];
  const idx = findDataRowIndex(values, row.id);
  const sheetRow = idx >= 0 ? idx + 1 : Math.max(values.length, 2) + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${escapedTab()}!A${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [toSheetValues(row)] },
  });
}

export async function deleteExpenseSheetRow(id: string): Promise<boolean> {
  const { spreadsheetId, sheetId } = await ensureExpensesTab();
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapedTab()}!A:A`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const values = (res.data.values as string[][]) ?? [];
  const idx = findDataRowIndex(values, id);
  if (idx < 0) return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: idx,
              endIndex: idx + 1,
            },
          },
        },
      ],
    },
  });
  return true;
}
