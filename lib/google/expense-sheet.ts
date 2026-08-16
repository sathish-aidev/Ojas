import { getSheetsClient } from "./sheets-client";
import {
  EXPENSES_TAB_NAME,
  EXPENSE_SHEET_HEADERS,
  getExpensesSpreadsheetId,
} from "@/lib/sheet-config";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  paymentModeLabel,
} from "@/lib/revenue-constants";
import { PAYMENT_MODE_LABELS } from "@/lib/utils";
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

const INSTRUCTION_ROW =
  "Impackt Fitness Expenses | Editable in app and sheet | Dates: DD/MM/YYYY | Category: Rent, Power Bill, Repairs, Supplies, Internet, Phone, Salaries, Maintenance, Others | Leave Id blank for new rows — Sync from expense sheet fills it";

function escapedTab(title = EXPENSES_TAB_NAME) {
  return `'${title.replace(/'/g, "''")}'`;
}

function hasExpenseHeaders(rows: string[][]): boolean {
  return rows.some((row) => {
    const cells = row.map((c) => (c ?? "").trim().toLowerCase());
    return cells.includes("date") && cells.includes("category") && cells.includes("amount");
  });
}

async function seedExpensesTemplate(
  spreadsheetId: string,
  sheetId: number,
  title: string
): Promise<void> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapedTab(title)}!A:H`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = (res.data.values as string[][]) ?? [];
  if (hasExpenseHeaders(rows)) return;

  const hasData = rows.some((row) => row.some((cell) => (cell ?? "").trim()));
  if (hasData) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            insertDimension: {
              range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 2 },
              inheritFromBefore: false,
            },
          },
        ],
      },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${escapedTab(title)}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[INSTRUCTION_ROW], [...EXPENSE_SHEET_HEADERS]],
    },
  });

  const categoryValues = EXPENSE_CATEGORIES.map((key) => ({
    userEnteredValue: EXPENSE_CATEGORY_LABELS[key],
  }));
  const paymentValues = Object.values(PAYMENT_MODE_LABELS).map((label) => ({
    userEnteredValue: label,
  }));

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
            range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 8 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.93, green: 0.93, blue: 0.93 },
              },
            },
            fields: "userEnteredFormat(textFormat,backgroundColor)",
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 8 },
            properties: { pixelSize: 130 },
            fields: "pixelSize",
          },
        },
        {
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: 2,
              endRowIndex: 1000,
              startColumnIndex: 2,
              endColumnIndex: 3,
            },
            rule: {
              condition: { type: "ONE_OF_LIST", values: categoryValues },
              showCustomUi: true,
              strict: false,
            },
          },
        },
        {
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: 2,
              endRowIndex: 1000,
              startColumnIndex: 5,
              endColumnIndex: 6,
            },
            rule: {
              condition: { type: "ONE_OF_LIST", values: paymentValues },
              showCustomUi: true,
              strict: false,
            },
          },
        },
      ],
    },
  });
}

export async function ensureExpensesTab(): Promise<{ spreadsheetId: string; sheetId: number }> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getExpensesSpreadsheetId();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });

  const sheetsMeta = meta.data.sheets ?? [];
  const exact = sheetsMeta.find((s) => s.properties?.title === EXPENSES_TAB_NAME);
  const loose = sheetsMeta.find(
    (s) => s.properties?.title?.trim().toLowerCase() === EXPENSES_TAB_NAME.toLowerCase()
  );
  let sheetId = exact?.properties?.sheetId ?? loose?.properties?.sheetId ?? null;
  let title = exact?.properties?.title ?? loose?.properties?.title ?? EXPENSES_TAB_NAME;

  if (sheetId == null) {
    const added = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: EXPENSES_TAB_NAME } } }],
      },
    });
    sheetId = added.data.replies?.[0]?.addSheet?.properties?.sheetId ?? null;
    title = EXPENSES_TAB_NAME;
    if (sheetId == null) throw new Error("Failed to create Expenses tab");
  } else if (title !== EXPENSES_TAB_NAME) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId, title: EXPENSES_TAB_NAME },
              fields: "title",
            },
          },
        ],
      },
    });
    title = EXPENSES_TAB_NAME;
  }

  await seedExpensesTemplate(spreadsheetId, sheetId, title);
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
    [INSTRUCTION_ROW],
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
