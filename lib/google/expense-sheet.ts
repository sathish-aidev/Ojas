import { getSheetsClient } from "./sheets-client";
import { padValuesToA1 } from "./sheet-grid";
import {
  EXPENSES_TAB_NAME,
  EXPENSE_SHEET_HEADERS,
  SUPERVISOR_SPEND_SHEET_HEADERS,
  SUPERVISOR_SPENDS_TAB_NAME,
  getExpensesSpreadsheetId,
} from "@/lib/sheet-config";
import { EXPENSE_CATEGORY_LABELS, paymentModeLabel } from "@/lib/revenue-constants";
import {
  EXPENSE_KIND_LABELS,
  OWNER_BILL_CATEGORIES,
  SUPERVISOR_SPEND_CATEGORIES,
} from "@/lib/services/expense-kinds";
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

export type ExpenseLedger = "owner" | "supervisor";

export type ExpenseSheetTabRows = {
  ledger: ExpenseLedger;
  title: string;
  rows: string[][];
  defaultKind: ExpenseKind;
};

type TabSpec = {
  ledger: ExpenseLedger;
  title: string;
  headers: readonly string[];
  instruction: string;
  defaultKind: ExpenseKind;
  typeKinds: ExpenseKind[];
  categories: ExpenseCategory[];
};

const OWNER_INSTRUCTION =
  "Impackt Fitness Expenses | Owner gym costs only (in Revenue) | Type: Owner bill or Cash given to supervisor | Dates: DD/MM/YYYY | Supervisor spends go on the Supervisor spends tab | Leave Id blank for new rows";

const SUPERVISOR_INSTRUCTION =
  "Impackt Fitness Supervisor spends | Tracked only — not in Revenue | Dates: DD/MM/YYYY | Leave Id blank for new rows — Sync from expense sheet fills it";

const OWNER_TAB: TabSpec = {
  ledger: "owner",
  title: EXPENSES_TAB_NAME,
  headers: EXPENSE_SHEET_HEADERS,
  instruction: OWNER_INSTRUCTION,
  defaultKind: "OWNER_BILL",
  typeKinds: ["OWNER_BILL", "SUPERVISOR_ADVANCE"],
  categories: OWNER_BILL_CATEGORIES,
};

const SUPERVISOR_TAB: TabSpec = {
  ledger: "supervisor",
  title: SUPERVISOR_SPENDS_TAB_NAME,
  headers: SUPERVISOR_SPEND_SHEET_HEADERS,
  instruction: SUPERVISOR_INSTRUCTION,
  defaultKind: "SUPERVISOR_SPEND",
  typeKinds: ["SUPERVISOR_SPEND"],
  categories: SUPERVISOR_SPEND_CATEGORIES,
};

const TABS: Record<ExpenseLedger, TabSpec> = {
  owner: OWNER_TAB,
  supervisor: SUPERVISOR_TAB,
};

function specForKind(kind: ExpenseKind): TabSpec {
  return kind === "SUPERVISOR_SPEND" ? SUPERVISOR_TAB : OWNER_TAB;
}

function escapedTab(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function colLetter(count: number) {
  return String.fromCharCode(64 + count);
}

function sheetRange(headers: readonly string[]) {
  return `A:${colLetter(headers.length)}`;
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

function findHeaderRowIndex(rows: string[][]): number {
  return rows.findIndex((row) => {
    const cells = row.map((c) => (c ?? "").trim().toLowerCase());
    return cells.includes("date") && cells.includes("category") && cells.includes("amount");
  });
}

function colIndex(headers: readonly string[], name: string) {
  return headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
}

function googleErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as {
      message?: string;
      errors?: Array<{ message?: string }>;
      response?: { data?: { error?: { message?: string } } };
    };
    return (
      e.response?.data?.error?.message ||
      e.errors?.[0]?.message ||
      e.message ||
      String(err)
    );
  }
  return String(err);
}

async function batchUpdateBestEffort(
  spreadsheetId: string,
  requests: object[],
  label: string
): Promise<void> {
  if (requests.length === 0) return;
  try {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  } catch (err) {
    console.warn(`expense sheet ${label}: ${googleErrorMessage(err)}`);
  }
}

/** Dropdowns and date format are cosmetic. Typed Table columns reject setDataValidation. */
async function applySheetChrome(spreadsheetId: string, sheetId: number, spec: TabSpec): Promise<void> {
  const categoryValues = spec.categories.map((key) => ({
    userEnteredValue: EXPENSE_CATEGORY_LABELS[key],
  }));
  const typeValues = spec.typeKinds.map((key) => ({
    userEnteredValue: EXPENSE_KIND_LABELS[key],
  }));
  const paymentValues = Object.values(PAYMENT_MODE_LABELS).map((label) => ({
    userEnteredValue: label,
  }));
  const typeCol = colIndex(spec.headers, "Type");
  const categoryCol = colIndex(spec.headers, "Category");
  const paymentCol = colIndex(spec.headers, "Payment Mode");
  const dateCol = colIndex(spec.headers, "Date");
  const colCount = spec.headers.length;

  await batchUpdateBestEffort(
    spreadsheetId,
    [
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
            endColumnIndex: colCount,
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
          range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: colCount },
          properties: { pixelSize: 130 },
          fields: "pixelSize",
        },
      },
    ],
    `${spec.title} layout`
  );

  if (dateCol >= 0) {
    await batchUpdateBestEffort(
      spreadsheetId,
      [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 2,
              endRowIndex: 1000,
              startColumnIndex: dateCol,
              endColumnIndex: dateCol + 1,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "DATE", pattern: "dd/mm/yyyy" },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        },
      ],
      `${spec.title} date format`
    );
  }

  const dropdowns: Array<{ col: number; values: Array<{ userEnteredValue: string }>; label: string }> =
    [];
  if (typeCol >= 0) dropdowns.push({ col: typeCol, values: typeValues, label: "Type" });
  if (categoryCol >= 0) dropdowns.push({ col: categoryCol, values: categoryValues, label: "Category" });
  if (paymentCol >= 0) dropdowns.push({ col: paymentCol, values: paymentValues, label: "Payment Mode" });

  for (const dropdown of dropdowns) {
    await batchUpdateBestEffort(
      spreadsheetId,
      [
        {
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: 2,
              endRowIndex: 1000,
              startColumnIndex: dropdown.col,
              endColumnIndex: dropdown.col + 1,
            },
            rule: {
              condition: { type: "ONE_OF_LIST", values: dropdown.values },
              showCustomUi: true,
              strict: false,
            },
          },
        },
      ],
      `${spec.title} ${dropdown.label} dropdown`
    );
  }
}

async function insertOwnerTypeColumn(
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

  const headerIdx = findHeaderRowIndex(rows);
  const headerRowNumber = headerIdx >= 0 ? headerIdx + 1 : 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${escapedTab(title)}!C${headerRowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [["Type"]] },
  });

  const fillStart = headerRowNumber + 1;
  const dataCount = Math.max(0, rows.length - (headerIdx >= 0 ? headerIdx + 1 : 2));
  if (dataCount > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${escapedTab(title)}!C${fillStart}:C${fillStart + dataCount - 1}`,
      valueInputOption: "RAW",
      requestBody: {
        values: Array.from({ length: dataCount }, () => [EXPENSE_KIND_LABELS.OWNER_BILL]),
      },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${escapedTab(title)}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [[OWNER_TAB.instruction]] },
  });

  await applySheetChrome(spreadsheetId, sheetId, OWNER_TAB);
}

async function seedTab(spreadsheetId: string, sheetId: number, spec: TabSpec): Promise<void> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapedTab(spec.title)}!A1:Z`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  const rows = padValuesToA1((res.data.values as unknown[][]) ?? [], res.data.range);
  if (hasExpenseHeaders(rows)) {
    if (spec.ledger === "owner" && !hasTypeHeader(rows)) {
      try {
        await insertOwnerTypeColumn(spreadsheetId, sheetId, spec.title, rows);
      } catch (err) {
        console.warn(`expense sheet insert Type column: ${googleErrorMessage(err)}`);
      }
    }
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
    range: `${escapedTab(spec.title)}!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[spec.instruction], [...spec.headers]],
    },
  });

  await applySheetChrome(spreadsheetId, sheetId, spec);
}

async function findOrCreateTab(
  spreadsheetId: string,
  desiredTitle: string
): Promise<{ sheetId: number; title: string }> {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const sheetsMeta = meta.data.sheets ?? [];
  const exact = sheetsMeta.find((s) => s.properties?.title === desiredTitle);
  const loose = sheetsMeta.find(
    (s) => s.properties?.title?.trim().toLowerCase() === desiredTitle.toLowerCase()
  );
  let sheetId = exact?.properties?.sheetId ?? loose?.properties?.sheetId ?? null;
  let title = exact?.properties?.title ?? loose?.properties?.title ?? desiredTitle;

  if (sheetId == null) {
    const added = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: desiredTitle } } }],
      },
    });
    sheetId = added.data.replies?.[0]?.addSheet?.properties?.sheetId ?? null;
    title = desiredTitle;
    if (sheetId == null) throw new Error(`Failed to create ${desiredTitle} tab`);
  } else if (title !== desiredTitle) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId, title: desiredTitle },
              fields: "title",
            },
          },
        ],
      },
    });
    title = desiredTitle;
  }

  return { sheetId, title };
}

function toSheetValues(row: ExpenseSheetRow, spec: TabSpec): string[] {
  const withType = [
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
  if (colIndex(spec.headers, "Type") >= 0) return withType;
  return [withType[0], withType[1], ...withType.slice(3)];
}

function findDataRowIndex(values: string[][], id: string): number {
  const headerIdx = findHeaderRowIndex(values);
  if (headerIdx < 0) return -1;
  const header = values[headerIdx].map((h) => (h ?? "").trim());
  const idCol = colIndex(header, "Id");
  const col = idCol >= 0 ? idCol : 0;
  const start = headerIdx + 1;
  return values.findIndex((row, idx) => idx >= start && (row[col] ?? "").trim() === id);
}

async function readTabValues(spreadsheetId: string, spec: TabSpec): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapedTab(spec.title)}!A1:Z`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  return padValuesToA1((res.data.values as unknown[][]) ?? [], res.data.range);
}

function ownerRowToSupervisorValues(row: string[], header: string[]): string[] {
  const typeCol = header.findIndex((h) => h.trim().toLowerCase() === "type");
  if (typeCol < 0) return row;
  return row.filter((_, i) => i !== typeCol);
}

async function migrateSupervisorSpendsFromOwnerTab(
  spreadsheetId: string,
  ownerSheetId: number,
  supervisorSheetId: number
): Promise<void> {
  const sheets = await getSheetsClient();
  const ownerRows = await readTabValues(spreadsheetId, OWNER_TAB);
  const headerIdx = findHeaderRowIndex(ownerRows);
  if (headerIdx < 0) return;
  const header = ownerRows[headerIdx].map((h) => (h ?? "").trim());
  const typeCol = header.findIndex((h) => h.toLowerCase() === "type");
  if (typeCol < 0) return;

  const moveIdx: number[] = [];
  const moveValues: string[][] = [];
  for (let i = headerIdx + 1; i < ownerRows.length; i++) {
    const row = ownerRows[i] ?? [];
    const typeRaw = (row[typeCol] ?? "").trim().toLowerCase();
    if (typeRaw.includes("supervisor spend") || typeRaw === "spend" || typeRaw === "type 2") {
      moveIdx.push(i);
      moveValues.push(ownerRowToSupervisorValues(row, header));
    }
  }
  if (moveIdx.length === 0) return;

  const supervisorRows = await readTabValues(spreadsheetId, SUPERVISOR_TAB);
  const existingIds = new Set(
    supervisorRows
      .slice(Math.max(0, findHeaderRowIndex(supervisorRows) + 1))
      .map((row) => (row[0] ?? "").trim())
      .filter(Boolean)
  );
  const toAppend = moveValues.filter((row) => {
    const id = (row[0] ?? "").trim();
    return !id || !existingIds.has(id);
  });
  if (toAppend.length > 0) {
    const startRow = Math.max(supervisorRows.length, 2) + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${escapedTab(SUPERVISOR_TAB.title)}!A${startRow}`,
      valueInputOption: "RAW",
      requestBody: { values: toAppend },
    });
  }

  for (const idx of [...moveIdx].sort((a, b) => b - a)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: ownerSheetId,
                dimension: "ROWS",
                startIndex: idx,
                endIndex: idx + 1,
              },
            },
          },
        ],
      },
    });
  }

  await applySheetChrome(spreadsheetId, supervisorSheetId, SUPERVISOR_TAB);
}

export type ExpenseSheetsHandle = {
  spreadsheetId: string;
  ownerSheetId: number;
  supervisorSheetId: number;
};

export async function ensureExpenseSheets(): Promise<ExpenseSheetsHandle> {
  const spreadsheetId = getExpensesSpreadsheetId();
  const owner = await findOrCreateTab(spreadsheetId, OWNER_TAB.title);
  const supervisor = await findOrCreateTab(spreadsheetId, SUPERVISOR_TAB.title);
  try {
    await seedTab(spreadsheetId, owner.sheetId, OWNER_TAB);
  } catch (err) {
    console.warn(`expense sheet seed ${OWNER_TAB.title}: ${googleErrorMessage(err)}`);
  }
  try {
    await seedTab(spreadsheetId, supervisor.sheetId, SUPERVISOR_TAB);
  } catch (err) {
    console.warn(`expense sheet seed ${SUPERVISOR_TAB.title}: ${googleErrorMessage(err)}`);
  }
  try {
    await migrateSupervisorSpendsFromOwnerTab(spreadsheetId, owner.sheetId, supervisor.sheetId);
  } catch (err) {
    console.warn(`expense sheet migrate supervisor spends: ${googleErrorMessage(err)}`);
  }
  return {
    spreadsheetId,
    ownerSheetId: owner.sheetId,
    supervisorSheetId: supervisor.sheetId,
  };
}

export async function ensureExpensesTab(): Promise<{ spreadsheetId: string; sheetId: number }> {
  const sheets = await ensureExpenseSheets();
  return { spreadsheetId: sheets.spreadsheetId, sheetId: sheets.ownerSheetId };
}

export async function fetchExpenseSheetRows(): Promise<string[][]> {
  const { spreadsheetId } = await ensureExpenseSheets();
  return readTabValues(spreadsheetId, OWNER_TAB);
}

export async function fetchAllExpenseSheetRows(): Promise<ExpenseSheetTabRows[]> {
  const { spreadsheetId } = await ensureExpenseSheets();
  const [ownerRows, supervisorRows] = await Promise.all([
    readTabValues(spreadsheetId, OWNER_TAB),
    readTabValues(spreadsheetId, SUPERVISOR_TAB),
  ]);
  return [
    {
      ledger: "owner",
      title: OWNER_TAB.title,
      rows: ownerRows,
      defaultKind: OWNER_TAB.defaultKind,
    },
    {
      ledger: "supervisor",
      title: SUPERVISOR_TAB.title,
      rows: supervisorRows,
      defaultKind: SUPERVISOR_TAB.defaultKind,
    },
  ];
}

function isCanonicalLayout(values: string[][]): boolean {
  const headerIdx = findHeaderRowIndex(values);
  if (headerIdx !== 1) return false;
  const header = (values[1] ?? []).map((h) => (h ?? "").trim().toLowerCase());
  return header[0] === "id" && header.includes("date") && header.includes("amount");
}

async function rewriteTab(spreadsheetId: string, sheetId: number, spec: TabSpec, rows: ExpenseSheetRow[]) {
  const existing = await readTabValues(spreadsheetId, spec);
  if (hasExpenseHeaders(existing) && !isCanonicalLayout(existing)) {
    throw new Error(
      `${spec.title} is not the app layout (Table or headers not on row 2 with Id in column A)`
    );
  }
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${escapedTab(spec.title)}!${sheetRange(spec.headers)}`,
  });
  const values = [[spec.instruction], [...spec.headers], ...rows.map((row) => toSheetValues(row, spec))];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${escapedTab(spec.title)}!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });
  await applySheetChrome(spreadsheetId, sheetId, spec);
}

export async function rewriteExpenseSheet(rows: ExpenseSheetRow[]): Promise<void> {
  const handle = await ensureExpenseSheets();
  const failures: string[] = [];
  try {
    await rewriteTab(
      handle.spreadsheetId,
      handle.ownerSheetId,
      OWNER_TAB,
      rows.filter((row) => specForKind(row.kind).ledger === "owner")
    );
  } catch (err) {
    failures.push(googleErrorMessage(err));
  }
  try {
    await rewriteTab(
      handle.spreadsheetId,
      handle.supervisorSheetId,
      SUPERVISOR_TAB,
      rows.filter((row) => specForKind(row.kind).ledger === "supervisor")
    );
  } catch (err) {
    failures.push(googleErrorMessage(err));
  }
  if (failures.length > 0) {
    throw new Error(failures.join(" · "));
  }
}

export type ExpenseSheetIdWrite = {
  title: string;
  rowNumber: number;
  id: string;
};

/** When a Table blocks a full rewrite, stamp Ids onto existing rows so the next sync does not duplicate. */
export async function writeExpenseRowIds(updates: ExpenseSheetIdWrite[]): Promise<void> {
  if (updates.length === 0) return;
  const handle = await ensureExpenseSheets();
  const sheets = await getSheetsClient();
  const byTitle = new Map<string, ExpenseSheetIdWrite[]>();
  for (const update of updates) {
    const list = byTitle.get(update.title) ?? [];
    list.push(update);
    byTitle.set(update.title, list);
  }

  for (const [title, list] of byTitle) {
    const spec = title === SUPERVISOR_TAB.title ? SUPERVISOR_TAB : OWNER_TAB;
    const values = await readTabValues(handle.spreadsheetId, spec);
    const headerIdx = findHeaderRowIndex(values);
    if (headerIdx < 0) continue;
    const headerRow = headerIdx + 1;
    const header = values[headerIdx].map((h) => (h ?? "").trim());
    let idCol = colIndex(header, "Id");
    if (idCol < 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: handle.spreadsheetId,
        range: `${escapedTab(title)}!A${headerRow}`,
        valueInputOption: "RAW",
        requestBody: { values: [["Id"]] },
      });
      idCol = 0;
    }
    const letter = colLetter(idCol + 1);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: handle.spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: list
          .filter((item) => item.rowNumber > headerRow)
          .map((item) => ({
            range: `${escapedTab(title)}!${letter}${item.rowNumber}`,
            values: [[item.id]],
          })),
      },
    });
  }
}

async function deleteFromTab(
  spreadsheetId: string,
  sheetId: number,
  spec: TabSpec,
  id: string
): Promise<boolean> {
  const sheets = await getSheetsClient();
  const values = await readTabValues(spreadsheetId, spec);
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

export async function upsertExpenseSheetRow(row: ExpenseSheetRow): Promise<void> {
  const handle = await ensureExpenseSheets();
  const target = specForKind(row.kind);
  const other = target.ledger === "owner" ? SUPERVISOR_TAB : OWNER_TAB;
  const otherSheetId = target.ledger === "owner" ? handle.supervisorSheetId : handle.ownerSheetId;
  await deleteFromTab(handle.spreadsheetId, otherSheetId, other, row.id);

  const sheets = await getSheetsClient();
  const values = await readTabValues(handle.spreadsheetId, target);
  const idx = findDataRowIndex(values, row.id);
  const sheetRow = idx >= 0 ? idx + 1 : Math.max(values.length, 2) + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId: handle.spreadsheetId,
    range: `${escapedTab(target.title)}!A${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [toSheetValues(row, target)] },
  });
}

export async function deleteExpenseSheetRow(id: string): Promise<boolean> {
  const handle = await ensureExpenseSheets();
  const ownerDeleted = await deleteFromTab(handle.spreadsheetId, handle.ownerSheetId, OWNER_TAB, id);
  const spendDeleted = await deleteFromTab(
    handle.spreadsheetId,
    handle.supervisorSheetId,
    SUPERVISOR_TAB,
    id
  );
  return ownerDeleted || spendDeleted;
}

export function expenseSheetUrl(spreadsheetId: string, sheetId: number) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}#gid=${sheetId}`;
}
