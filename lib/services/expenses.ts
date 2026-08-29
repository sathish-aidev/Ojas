import type {
  ExpenseCategory,
  ExpenseKind,
  ExpenseSource,
  GymExpense,
  PaymentMode,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/utils";
import { formatDateDMY, parseSheetDate } from "@/lib/import/parse-csv-dates";
import { mapPaymentMode } from "@/lib/import/map-payment-mode";
import { parseMoney } from "@/lib/parse-money";
import { parseExpenseCategory, EXPENSE_CATEGORY_LABELS, paymentModeLabel } from "@/lib/revenue-constants";
import { fromYmd, toYmd, shiftMonth } from "@/lib/date-ymd";
import {
  deleteExpenseSheetRow,
  ensureExpenseSheets,
  expenseSheetUrl,
  fetchAllExpenseSheetRows,
  rewriteExpenseSheet,
  upsertExpenseSheetRow,
  writeExpenseRowIds,
  type ExpenseSheetRow,
} from "@/lib/google/expense-sheet";
import { EXPENSES_TAB_NAME, SUPERVISOR_SPENDS_TAB_NAME } from "@/lib/sheet-config";
import {
  authorizeExpenseWrite,
  defaultKindForRole,
  ExpenseWriteError,
  isCategoryAllowedForKind,
  parseExpenseKind,
  pettyCashFromRows,
  sumPnlExpenses,
  EXPENSE_KIND_LABELS,
} from "@/lib/services/expense-kinds";

export type SerializedExpense = {
  id: string;
  date: string;
  month: number;
  year: number;
  kind: ExpenseKind;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMode: PaymentMode | null;
  paidBy: string | null;
  notes: string | null;
  source: ExpenseSource;
  createdByUserId: string;
  createdByName: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseInput = {
  date: string;
  kind?: ExpenseKind;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMode?: PaymentMode;
  paidBy?: string;
  notes?: string;
};

function assertKindAndCategory(kind: ExpenseKind, category: ExpenseCategory) {
  if (!isCategoryAllowedForKind(kind, category)) {
    throw new ExpenseWriteError(400, "That category is not allowed for this expense type");
  }
}

async function userNames(gymId: string) {
  const users = await prisma.user.findMany({
    where: { gymId },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}

function toSheetPayload(expense: GymExpense): ExpenseSheetRow {
  return {
    id: expense.id,
    dateLabel: formatDateDMY(expense.date),
    kind: expense.kind,
    category: expense.category,
    description: expense.description,
    amount: decimalToNumber(expense.amount),
    paymentMode: expense.paymentMode,
    paidBy: expense.paidBy,
    notes: expense.notes,
  };
}

function serialize(expense: GymExpense, names: Map<string, string>): SerializedExpense {
  return {
    id: expense.id,
    date: toYmd(expense.date),
    month: expense.month,
    year: expense.year,
    kind: expense.kind,
    category: expense.category,
    description: expense.description,
    amount: decimalToNumber(expense.amount),
    paymentMode: expense.paymentMode,
    paidBy: expense.paidBy,
    notes: expense.notes,
    source: expense.source,
    createdByUserId: expense.createdByUserId,
    createdByName: names.get(expense.createdByUserId) ?? null,
    updatedByUserId: expense.updatedByUserId,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

async function withSheetWrite(
  expense: GymExpense,
  action: "upsert" | "delete"
): Promise<string | null> {
  try {
    if (action === "delete") {
      await deleteExpenseSheetRow(expense.id);
    } else {
      await upsertExpenseSheetRow(toSheetPayload(expense));
    }
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Google Sheet update failed";
  }
}

export async function prepareExpenseSheet(): Promise<{
  spreadsheetUrl: string | null;
  supervisorSpreadsheetUrl: string | null;
  tabName: string;
  supervisorTabName: string;
  error: string | null;
}> {
  try {
    const tabs = await ensureExpenseSheets();
    return {
      spreadsheetUrl: expenseSheetUrl(tabs.spreadsheetId, tabs.ownerSheetId),
      supervisorSpreadsheetUrl: expenseSheetUrl(tabs.spreadsheetId, tabs.supervisorSheetId),
      tabName: EXPENSES_TAB_NAME,
      supervisorTabName: SUPERVISOR_SPENDS_TAB_NAME,
      error: null,
    };
  } catch (err) {
    return {
      spreadsheetUrl: null,
      supervisorSpreadsheetUrl: null,
      tabName: EXPENSES_TAB_NAME,
      supervisorTabName: SUPERVISOR_SPENDS_TAB_NAME,
      error: err instanceof Error ? err.message : "Could not open the Expenses sheets",
    };
  }
}

export async function listExpenses(
  gymId: string,
  month?: number,
  year?: number,
  role?: UserRole
) {
  const names = await userNames(gymId);
  const expenses = await prisma.gymExpense.findMany({
    where: {
      gymId,
      ...(month && year ? { month, year } : year ? { year } : {}),
      ...(role === "SUPERVISOR"
        ? { kind: { in: ["SUPERVISOR_ADVANCE", "SUPERVISOR_SPEND"] } }
        : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return expenses.map((e) => serialize(e, names));
}

type CategoryAmount = { category: ExpenseCategory; label: string; amount: number };

function categoryTotals(
  rows: Array<{ kind: ExpenseKind; category: ExpenseCategory; amount: { toString(): string } }>,
  kinds: ExpenseKind[]
): CategoryAmount[] {
  const map = new Map<ExpenseCategory, number>();
  for (const row of rows) {
    if (!kinds.includes(row.kind)) continue;
    const amount = decimalToNumber(row.amount);
    map.set(row.category, (map.get(row.category) ?? 0) + amount);
  }
  return [...map.entries()]
    .map(([category, amount]) => ({
      category,
      label: EXPENSE_CATEGORY_LABELS[category],
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export type ExpenseDashboard = {
  month: number;
  year: number;
  total: number;
  lastMonthTotal: number;
  momPercent: number | null;
  entryCount: number;
  ytdTotal: number;
  pettyIssuedMonth: number;
  pettySpentMonth: number;
  pettyIssuedAll: number;
  pettySpentAll: number;
  pettyRemaining: number;
  topCategory: { label: string; amount: number } | null;
  byCategory: CategoryAmount[];
  spendByCategory: CategoryAmount[];
  byPaymentMode: Array<{ mode: string; label: string; amount: number }>;
  trend: Array<{
    month: number;
    year: number;
    label: string;
    total: number;
    pnlTotal: number;
    spendTotal: number;
  }>;
};

export async function getExpenseDashboard(
  gymId: string,
  month: number,
  year: number
): Promise<ExpenseDashboard> {
  const prev = shiftMonth(month, year, -1);
  const trendKeys = Array.from({ length: 12 }, (_, i) => shiftMonth(month, year, -(11 - i)));

  const [monthRows, lastRows, ytdRows, trendRows, floatRows] = await Promise.all([
    prisma.gymExpense.findMany({ where: { gymId, month, year } }),
    prisma.gymExpense.findMany({ where: { gymId, month: prev.month, year: prev.year } }),
    prisma.gymExpense.findMany({ where: { gymId, year } }),
    prisma.gymExpense.findMany({
      where: {
        gymId,
        OR: trendKeys.map((key) => ({ month: key.month, year: key.year })),
      },
      select: { month: true, year: true, amount: true, kind: true },
    }),
    prisma.gymExpense.findMany({
      where: { gymId, kind: { in: ["SUPERVISOR_ADVANCE", "SUPERVISOR_SPEND"] } },
      select: { kind: true, amount: true },
    }),
  ]);

  const asKindRows = (rows: Array<{ kind: ExpenseKind; amount: { toString(): string } }>) =>
    rows.map((row) => ({ kind: row.kind, amount: decimalToNumber(row.amount) }));

  const total = sumPnlExpenses(asKindRows(monthRows));
  const lastMonthTotal = sumPnlExpenses(asKindRows(lastRows));
  const ytdTotal = sumPnlExpenses(asKindRows(ytdRows));
  const momPercent =
    lastMonthTotal === 0 ? (total > 0 ? 100 : null) : ((total - lastMonthTotal) / lastMonthTotal) * 100;

  const monthPetty = pettyCashFromRows(asKindRows(monthRows));
  const allPetty = pettyCashFromRows(asKindRows(floatRows));

  const byCategory = categoryTotals(monthRows, ["OWNER_BILL", "SUPERVISOR_ADVANCE"]);
  const spendByCategory = categoryTotals(monthRows, ["SUPERVISOR_SPEND"]);

  const byModeMap = new Map<string, number>();
  for (const row of monthRows) {
    if (row.kind === "SUPERVISOR_SPEND") continue;
    const amount = decimalToNumber(row.amount);
    const mode = row.paymentMode ?? "UNSET";
    byModeMap.set(mode, (byModeMap.get(mode) ?? 0) + amount);
  }

  const byPaymentMode = [...byModeMap.entries()]
    .map(([mode, amount]) => ({
      mode,
      label: mode === "UNSET" ? "Not set" : paymentModeLabel(mode as PaymentMode) || mode,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  const trendPnl = new Map<string, number>();
  const trendSpend = new Map<string, number>();
  for (const row of trendRows) {
    const key = `${row.year}-${row.month}`;
    const amount = decimalToNumber(row.amount);
    if (row.kind === "SUPERVISOR_SPEND") {
      trendSpend.set(key, (trendSpend.get(key) ?? 0) + amount);
    } else {
      trendPnl.set(key, (trendPnl.get(key) ?? 0) + amount);
    }
  }

  return {
    month,
    year,
    total,
    lastMonthTotal,
    momPercent,
    entryCount: monthRows.filter((row) => row.kind !== "SUPERVISOR_SPEND").length,
    ytdTotal,
    pettyIssuedMonth: monthPetty.issued,
    pettySpentMonth: monthPetty.spent,
    pettyIssuedAll: allPetty.issued,
    pettySpentAll: allPetty.spent,
    pettyRemaining: allPetty.remaining,
    topCategory: byCategory[0] ?? null,
    byCategory,
    spendByCategory,
    byPaymentMode,
    trend: trendKeys.map((key) => {
      const mapKey = `${key.year}-${key.month}`;
      const pnlTotal = trendPnl.get(mapKey) ?? 0;
      const spendTotal = trendSpend.get(mapKey) ?? 0;
      return {
        month: key.month,
        year: key.year,
        label: `${String(key.month).padStart(2, "0")}/${key.year}`,
        total: pnlTotal,
        pnlTotal,
        spendTotal,
      };
    }),
  };
}

export async function createExpense(
  gymId: string,
  user: { id: string; role: UserRole },
  input: ExpenseInput
) {
  const kind = input.kind ?? defaultKindForRole(user.role);
  const authorized = authorizeExpenseWrite({
    role: user.role,
    action: "create",
    requestedKind: kind,
  });
  if (!authorized.ok) throw new ExpenseWriteError(authorized.status, authorized.message);
  assertKindAndCategory(kind, input.category);

  const date = fromYmd(input.date);
  const expense = await prisma.gymExpense.create({
    data: {
      gymId,
      date,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      kind,
      category: input.category,
      description: input.description.trim(),
      amount: input.amount,
      paymentMode: input.paymentMode,
      paidBy: input.paidBy?.trim() || null,
      notes: input.notes?.trim() || null,
      createdByUserId: user.id,
      source: "APP",
    },
  });
  const sheetError = await withSheetWrite(expense, "upsert");
  const names = await userNames(gymId);
  return { expense: serialize(expense, names), sheetError };
}

export async function updateExpense(
  gymId: string,
  user: { id: string; role: UserRole },
  expenseId: string,
  input: Partial<ExpenseInput>
) {
  const existing = await prisma.gymExpense.findFirst({
    where: { id: expenseId, gymId },
  });
  if (!existing) return null;

  const kind = input.kind ?? existing.kind;
  const authorized = authorizeExpenseWrite({
    role: user.role,
    action: "update",
    requestedKind: kind,
    existingKind: existing.kind,
  });
  if (!authorized.ok) throw new ExpenseWriteError(authorized.status, authorized.message);
  const category = input.category ?? existing.category;
  assertKindAndCategory(kind, category);

  const date = input.date ? fromYmd(input.date) : existing.date;
  const expense = await prisma.gymExpense.update({
    where: { id: expenseId },
    data: {
      ...(input.date
        ? { date, month: date.getMonth() + 1, year: date.getFullYear() }
        : {}),
      kind,
      category,
      ...(input.description != null ? { description: input.description.trim() } : {}),
      ...(input.amount != null ? { amount: input.amount } : {}),
      ...(input.paymentMode !== undefined ? { paymentMode: input.paymentMode } : {}),
      ...(input.paidBy !== undefined ? { paidBy: input.paidBy.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
      updatedByUserId: user.id,
    },
  });
  const sheetError = await withSheetWrite(expense, "upsert");
  const names = await userNames(gymId);
  return { expense: serialize(expense, names), sheetError };
}

export async function deleteExpense(
  gymId: string,
  user: { id: string; role: UserRole },
  expenseId: string
) {
  const existing = await prisma.gymExpense.findFirst({
    where: { id: expenseId, gymId },
  });
  if (!existing) return null;
  const authorized = authorizeExpenseWrite({
    role: user.role,
    action: "delete",
    requestedKind: existing.kind,
    existingKind: existing.kind,
  });
  if (!authorized.ok) throw new ExpenseWriteError(authorized.status, authorized.message);
  await prisma.gymExpense.delete({ where: { id: expenseId } });
  const sheetError = await withSheetWrite(existing, "delete");
  return { id: expenseId, sheetError };
}

function findHeaderRow(rows: string[][]): number {
  return rows.findIndex((row) => {
    const cells = row.map((c) => c.trim().toLowerCase());
    return cells.includes("date") && cells.includes("category") && cells.includes("amount");
  });
}

function colIndex(header: string[], name: string) {
  return header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
}

function cell(row: string[], idx: number) {
  return idx >= 0 ? (row[idx] ?? "").trim() : "";
}

function parseExpenseTabRows(
  tabLabel: string,
  rows: string[][],
  defaultKind: ExpenseKind
): Array<{
  rowNumber: number;
  id: string;
  data: {
    date: Date;
    month: number;
    year: number;
    kind: ExpenseKind;
    category: ExpenseCategory;
    description: string;
    amount: number;
    paymentMode: PaymentMode | null;
    paidBy: string | null;
    notes: string | null;
  };
  error?: string;
}> {
  const parsed: Array<{
    rowNumber: number;
    id: string;
    data: {
      date: Date;
      month: number;
      year: number;
      kind: ExpenseKind;
      category: ExpenseCategory;
      description: string;
      amount: number;
      paymentMode: PaymentMode | null;
      paidBy: string | null;
      notes: string | null;
    };
    error?: string;
  }> = [];
  const headerIdx = findHeaderRow(rows);
  if (headerIdx < 0) {
    parsed.push({
      rowNumber: 0,
      id: "",
      data: {
        date: new Date(0),
        month: 1,
        year: 1970,
        kind: defaultKind,
        category: "OTHERS",
        description: "",
        amount: 0,
        paymentMode: null,
        paidBy: null,
        notes: null,
      },
      error: `${tabLabel} is missing a header row (Date, Category, Amount)`,
    });
    return parsed;
  }

  const header = rows[headerIdx].map((h) => h.trim());
  const idCol = colIndex(header, "Id");
  const dateCol = colIndex(header, "Date");
  const typeCol = colIndex(header, "Type");
  const catCol = colIndex(header, "Category");
  const descCol = colIndex(header, "Description");
  const amtCol = colIndex(header, "Amount");
  const modeCol = colIndex(header, "Payment Mode");
  const paidCol = colIndex(header, "Paid By");
  const notesCol = colIndex(header, "Notes");

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = i + 1;
    const id = cell(row, idCol);
    const dateRaw = cell(row, dateCol);
    const categoryRaw = cell(row, catCol);
    const description = cell(row, descCol);
    const amountRaw = cell(row, amtCol);

    if (!dateRaw && !categoryRaw && !description && !amountRaw && !id) continue;

    const date = parseSheetDate(dateRaw);
    const kindRaw = cell(row, typeCol);
    const kind = kindRaw ? parseExpenseKind(kindRaw) : defaultKind;
    const category = parseExpenseCategory(categoryRaw);
    const amount = parseMoney(amountRaw);
    const label = `${tabLabel} row ${rowNumber}`;

    if (!date) {
      parsed.push({
        rowNumber,
        id,
        data: emptyParseData(defaultKind),
        error: `${label}: invalid date`,
      });
      continue;
    }
    if (!kind) {
      parsed.push({
        rowNumber,
        id,
        data: emptyParseData(defaultKind),
        error: `${label}: unknown type "${kindRaw}"`,
      });
      continue;
    }
    if (!category) {
      parsed.push({
        rowNumber,
        id,
        data: emptyParseData(defaultKind),
        error: `${label}: unknown category "${categoryRaw}"`,
      });
      continue;
    }
    if (!isCategoryAllowedForKind(kind, category)) {
      parsed.push({
        rowNumber,
        id,
        data: emptyParseData(defaultKind),
        error: `${label}: ${categoryRaw} is not allowed for ${kindRaw || EXPENSE_KIND_LABELS[kind]}`,
      });
      continue;
    }
    if (amount == null || amount <= 0) {
      parsed.push({
        rowNumber,
        id,
        data: emptyParseData(defaultKind),
        error: `${label}: amount must be greater than 0`,
      });
      continue;
    }
    if (!description) {
      parsed.push({
        rowNumber,
        id,
        data: emptyParseData(defaultKind),
        error: `${label}: description required`,
      });
      continue;
    }

    const payment = mapPaymentMode(cell(row, modeCol));
    parsed.push({
      rowNumber,
      id,
      data: {
        date,
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        kind,
        category,
        description,
        amount,
        paymentMode: cell(row, modeCol) ? payment.mode : null,
        paidBy: cell(row, paidCol) || null,
        notes: cell(row, notesCol) || null,
      },
    });
  }

  return parsed;
}

function emptyParseData(kind: ExpenseKind) {
  return {
    date: new Date(0),
    month: 1,
    year: 1970,
    kind,
    category: "OTHERS" as ExpenseCategory,
    description: "",
    amount: 0,
    paymentMode: null,
    paidBy: null,
    notes: null,
  };
}

export async function syncExpensesFromSheet(gymId: string, triggeredBy: string) {
  const tabs = await fetchAllExpenseSheetRows();
  const created: string[] = [];
  const updated: string[] = [];
  const errors: string[] = [];
  const idWrites: Array<{ title: string; rowNumber: number; id: string }> = [];

  for (const tab of tabs) {
    const parsed = parseExpenseTabRows(tab.title, tab.rows, tab.defaultKind);
    for (const item of parsed) {
      if (item.error) {
        errors.push(item.error);
        continue;
      }
      try {
        if (item.id) {
          const existing = await prisma.gymExpense.findFirst({
            where: { id: item.id, gymId },
          });
          if (existing) {
            await prisma.gymExpense.update({
              where: { id: item.id },
              data: { ...item.data, updatedByUserId: triggeredBy },
            });
            updated.push(item.id);
            continue;
          }
        }

        const createdRow = await prisma.gymExpense.create({
          data: {
            ...item.data,
            gymId,
            createdByUserId: triggeredBy,
            source: "IMPORT",
          },
        });
        created.push(createdRow.id);
        idWrites.push({ title: tab.title, rowNumber: item.rowNumber, id: createdRow.id });
      } catch (err) {
        errors.push(
          `${tab.title} row ${item.rowNumber}: ${err instanceof Error ? err.message : "save failed"}`
        );
      }
    }
  }

  let sheetError: string | null = null;
  try {
    const all = await prisma.gymExpense.findMany({
      where: { gymId },
      orderBy: { date: "asc" },
    });
    await rewriteExpenseSheet(all.map(toSheetPayload));
  } catch (err) {
    try {
      await writeExpenseRowIds(idWrites);
      sheetError =
        idWrites.length > 0
          ? "Imported. The sheet is a Table so it was not fully rewritten; new Ids were added in column A. Dates stay DD/MM/YYYY."
          : null;
    } catch (idErr) {
      const rewriteMsg = err instanceof Error ? err.message : "Failed to rewrite expense sheets";
      const idMsg = idErr instanceof Error ? idErr.message : "Failed to write Ids";
      sheetError = `${rewriteMsg}. Id writeback also failed: ${idMsg}`;
    }
  }

  const status =
    errors.length === 0 && !sheetError
      ? "SUCCESS"
      : created.length + updated.length > 0
        ? "PARTIAL"
        : "FAILED";

  await prisma.sheetSyncRun.create({
    data: {
      gymId,
      triggeredBy,
      source: "EXPENSE_SHEET",
      status,
      summary: {
        type: "expense_sync",
        created: created.length,
        updated: updated.length,
        errors,
        sheetError,
      },
    },
  });

  return {
    status,
    created: created.length,
    updated: updated.length,
    errors,
    sheetError,
  };
}
