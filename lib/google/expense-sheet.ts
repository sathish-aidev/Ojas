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
import { EXPENSE_KIND_LABELS, EXPENSE_KINDS } from "@/lib/services/expense-kinds";
import { PAYMENT_MODE_LABELS } from "@/lib/utils";
import type { ExpenseCategory, ExpenseKind, PaymentMode } from "@prisma/client";

export type ExpenseSheetRow = {
  id: string;
  dateLabel: string;
  kind: ExpenseKind;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMode: PaymentMode | null;
  paidBy: string | null;
  notes: string | null;
};

const COL_COUNT = EXPENSE_SHEET_HEADERS.length;
const SHEET_RANGE = `A:${String.fromCharCode(64 + COL_COUNT)}`;

const INSTRUCTION_ROW =
  "Impackt Fitness Expenses | Type: Owner bill (P&L), Cash given to supervisor (P&L + float), Supervisor spend (tracked, not in Revenue) | Dates: DD/MM/YYYY | Leave Id blank for new rows — Sync from expense sheet fills it";

function escapedTab(title = EXPENSES_TAB_NAME) {
  return `'${title.replace(/'/g, "''")}'`;
}

function headerCells(rows: string[][]): string[] {
  const row = rows.find((r) => {
    const cells = r.map((c) => (c ?? "").trim().toLowerCase());
    return cells.includes("date") && cells.includes("category") && cells.includes("amount");
  });
  return (row ?? []).map((c) => (c ?? "").trim().toLowerCase());
}

function hasExpenseHeaders(rows: string[][]): boolean {
  return headerCells(rows).includes("date");
}

function hasTypeHeader(rows: string[][]): boolean {
  return headerCells(rows).includes("type");
}

async function applyExpenseSheetChrome(spreadsheetId: string, sheetId: number): Promise<void> {
  const sheets = await getSheetsClient();
  const categoryValues = EXPENSE_CATEGORIES.map((key) => ({
    userEnteredValue: EXPENSE_CATEGORY_LABELS[key],
  }));
  const typeValues = EXPENSE_KINDS.map((key) => ({
    userEnteredValue: EXPENSE_KIND_LABELS[key],
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
            range: {
              sheetId,
              startRowIndex: 1,
              endRowIndex: 2,
              startColumnIndex: 0,
              endColumnIndex: COL_COUNT,
            },
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
            range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: COL_COUNT },
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
              condition: { type: "ONE_OF_LIST", values: typeValues },
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
              startColumnIndex: 3,
              endColumnIndex: 4,
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
              startColumnIndex: 6,
              endColumnIndex: 7,
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

async function seedExpensesTemplate(
  spreadsheetId: string,
  sheetId: number,
  title: string
): Promise<void> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapedTab(title)}!${SHEET_RANGE}`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  const rows = (res.data.values as string[][]) ?? [];
  if (hasExpenseHeaders(rows) && hasTypeHeader(rows)) return;

  if (hasExpenseHeaders(rows) && !hasTypeHeader(rows)) {
    await insertTypeColumn(spreadsheetId, sheetId, title, rows);
    return;
  }

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

  await applyExpenseSheetChrome(spreadsheetId, sheetId);
}

async function insertTypeColumn(
  spreadsheetId: string,
  sheetId: number,
  title: string,
  rows: string[][]
): Promise<void> {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: { sheetId, dimension: "COLUMNS", startIndex: 2, endIndex: 3 },
            inheritFromBefore: false,
          },
        },
      ],
    },
  });

  const headerIdx = rows.findIndex((row) => {
    const cells = row.map((c) => (c ?? "").trim().toLowerCase());
    return cells.includes("date") && cells.includes("category") && cells.includes("amount");
  });
  const headerRowNumber = headerIdx >= 0 ? headerIdx + 1 : 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${escapedTab(title)}!C${headerRowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [["Type"]] },
  });

  const fillStart = headerRowNumber + 1;
  const dataCount = Math.max(0, rows.length - (headerIdx >= 0 ? headerIdx + 1 : 2));
  if (dataCount > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${escapedTab(title)}!C${fillStart}:C${fillStart + dataCount - 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: Array.from({ length: dataCount }, () => [EXPENSE_KIND_LABELS.OWNER_BILL]),
      },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${escapedTab(title)}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[INSTRUCTION_ROW]] },
  });

  await applyExpenseSheetChrome(spreadsheetId, sheetId);
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
    range: `${escapedTab()}!${SHEET_RANGE}`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return (res.data.values as string[][]) ?? [];
}

function toSheetValues(row: ExpenseSheetRow): string[] {
  return [
    row.id,
    row.dateLabel,
    EXPENSE_KIND_LABELS[row.kind],
    EXPENSE_CATEGORY_LABELS[row.category],
    row.description,
    String(row.amount),
    paymentModeLabel(row.paymentMode),
    row.paidBy ?? "",
    row.notes ?? "",
  ];
}

export async function rewriteExpenseSheet(rows: ExpenseSheetRow[]): Promise<void> {
  const { spreadsheetId, sheetId } = await ensureExpensesTab();
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${escapedTab()}!${SHEET_RANGE}`,
  });
  const values = [[INSTRUCTION_ROW], [...EXPENSE_SHEET_HEADERS], ...rows.map(toSheetValues)];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${escapedTab()}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
  await applyExpenseSheetChrome(spreadsheetId, sheetId);
}

function findDataRowIndex(values: string[][], id: string): number {
  return values.findIndex((row, idx) => idx >= 2 && (row[0] ?? "").trim() === id);
}

export async function upsertExpenseSheetRow(row: ExpenseSheetRow): Promise<void> {
  const { spreadsheetId } = await ensureExpensesTab();
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapedTab()}!${SHEET_RANGE}`,
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
