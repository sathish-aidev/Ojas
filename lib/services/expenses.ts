import type { ExpenseCategory, ExpenseSource, GymExpense, PaymentMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/utils";
import { formatDateDMY, parseFlexibleDate } from "@/lib/import/parse-csv-dates";
import { mapPaymentMode } from "@/lib/import/map-payment-mode";
import { parseMoney } from "@/lib/parse-money";
import { parseExpenseCategory, EXPENSE_CATEGORY_LABELS, paymentModeLabel } from "@/lib/revenue-constants";
import { fromYmd, toYmd, shiftMonth } from "@/lib/date-ymd";
import {
  deleteExpenseSheetRow,
  ensureExpensesTab,
  fetchExpenseSheetRows,
  rewriteExpenseSheet,
  upsertExpenseSheetRow,
  type ExpenseSheetRow,
} from "@/lib/google/expense-sheet";
import { EXPENSES_TAB_NAME } from "@/lib/sheet-config";

export type SerializedExpense = {
  id: string;
  date: string;
  month: number;
  year: number;
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
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMode?: PaymentMode;
  paidBy?: string;
  notes?: string;
};

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
  tabName: string;
  error: string | null;
}> {
  try {
    const tab = await ensureExpensesTab();
    return {
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${tab.spreadsheetId}#gid=${tab.sheetId}`,
      tabName: EXPENSES_TAB_NAME,
      error: null,
    };
  } catch (err) {
    return {
      spreadsheetUrl: null,
      tabName: EXPENSES_TAB_NAME,
      error: err instanceof Error ? err.message : "Could not open the Expenses sheet",
    };
  }
}

export async function listExpenses(gymId: string, month?: number, year?: number) {
  const names = await userNames(gymId);
  const expenses = await prisma.gymExpense.findMany({
    where: {
      gymId,
      ...(month && year ? { month, year } : year ? { year } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return expenses.map((e) => serialize(e, names));
}

export type ExpenseDashboard = {
  month: number;
  year: number;
  total: number;
  lastMonthTotal: number;
  momPercent: number | null;
  entryCount: number;
  ytdTotal: number;
  topCategory: { label: string; amount: number } | null;
  byCategory: Array<{ category: ExpenseCategory; label: string; amount: number }>;
  byPaymentMode: Array<{ mode: string; label: string; amount: number }>;
  trend: Array<{ month: number; year: number; label: string; total: number }>;
};

export async function getExpenseDashboard(
  gymId: string,
  month: number,
  year: number
): Promise<ExpenseDashboard> {
  const prev = shiftMonth(month, year, -1);
  const trendKeys = Array.from({ length: 12 }, (_, i) => shiftMonth(month, year, -(11 - i)));

  const [monthRows, lastRows, ytdRows, trendRows] = await Promise.all([
    prisma.gymExpense.findMany({ where: { gymId, month, year } }),
    prisma.gymExpense.findMany({ where: { gymId, month: prev.month, year: prev.year } }),
    prisma.gymExpense.findMany({ where: { gymId, year } }),
    prisma.gymExpense.findMany({
      where: {
        gymId,
        OR: trendKeys.map((key) => ({ month: key.month, year: key.year })),
      },
      select: { month: true, year: true, amount: true },
    }),
  ]);

  const sum = (rows: Array<{ amount: { toString(): string } }>) =>
    rows.reduce((s, row) => s + decimalToNumber(row.amount), 0);

  const total = sum(monthRows);
  const lastMonthTotal = sum(lastRows);
  const ytdTotal = sum(ytdRows);
  const momPercent =
    lastMonthTotal === 0 ? (total > 0 ? 100 : null) : ((total - lastMonthTotal) / lastMonthTotal) * 100;

  const byCategoryMap = new Map<ExpenseCategory, number>();
  const byModeMap = new Map<string, number>();
  for (const row of monthRows) {
    const amount = decimalToNumber(row.amount);
    byCategoryMap.set(row.category, (byCategoryMap.get(row.category) ?? 0) + amount);
    const mode = row.paymentMode ?? "UNSET";
    byModeMap.set(mode, (byModeMap.get(mode) ?? 0) + amount);
  }

  const byCategory = [...byCategoryMap.entries()]
    .map(([category, amount]) => ({
      category,
      label: EXPENSE_CATEGORY_LABELS[category],
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  const byPaymentMode = [...byModeMap.entries()]
    .map(([mode, amount]) => ({
      mode,
      label: mode === "UNSET" ? "Not set" : paymentModeLabel(mode as PaymentMode) || mode,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  const trendTotals = new Map<string, number>();
  for (const row of trendRows) {
    const key = `${row.year}-${row.month}`;
    trendTotals.set(key, (trendTotals.get(key) ?? 0) + decimalToNumber(row.amount));
  }

  return {
    month,
    year,
    total,
    lastMonthTotal,
    momPercent,
    entryCount: monthRows.length,
    ytdTotal,
    topCategory: byCategory[0] ?? null,
    byCategory,
    byPaymentMode,
    trend: trendKeys.map((key) => ({
      month: key.month,
      year: key.year,
      label: `${String(key.month).padStart(2, "0")}/${key.year}`,
      total: trendTotals.get(`${key.year}-${key.month}`) ?? 0,
    })),
  };
}

export async function createExpense(
  gymId: string,
  userId: string,
  input: ExpenseInput
) {
  const date = fromYmd(input.date);
  const expense = await prisma.gymExpense.create({
    data: {
      gymId,
      date,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      category: input.category,
      description: input.description.trim(),
      amount: input.amount,
      paymentMode: input.paymentMode,
      paidBy: input.paidBy?.trim() || null,
      notes: input.notes?.trim() || null,
      createdByUserId: userId,
      source: "APP",
    },
  });
  const sheetError = await withSheetWrite(expense, "upsert");
  const names = await userNames(gymId);
  return { expense: serialize(expense, names), sheetError };
}

export async function updateExpense(
  gymId: string,
  userId: string,
  expenseId: string,
  input: Partial<ExpenseInput>
) {
  const existing = await prisma.gymExpense.findFirst({
    where: { id: expenseId, gymId },
  });
  if (!existing) return null;

  const date = input.date ? fromYmd(input.date) : existing.date;
  const expense = await prisma.gymExpense.update({
    where: { id: expenseId },
    data: {
      ...(input.date
        ? { date, month: date.getMonth() + 1, year: date.getFullYear() }
        : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.description != null ? { description: input.description.trim() } : {}),
      ...(input.amount != null ? { amount: input.amount } : {}),
      ...(input.paymentMode !== undefined ? { paymentMode: input.paymentMode } : {}),
      ...(input.paidBy !== undefined ? { paidBy: input.paidBy.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
      updatedByUserId: userId,
    },
  });
  const sheetError = await withSheetWrite(expense, "upsert");
  const names = await userNames(gymId);
  return { expense: serialize(expense, names), sheetError };
}

export async function deleteExpense(gymId: string, expenseId: string) {
  const existing = await prisma.gymExpense.findFirst({
    where: { id: expenseId, gymId },
  });
  if (!existing) return null;
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

export async function syncExpensesFromSheet(gymId: string, triggeredBy: string) {
  const rows = await fetchExpenseSheetRows();
  const headerIdx = findHeaderRow(rows);
  const created: string[] = [];
  const updated: string[] = [];
  const errors: string[] = [];

  if (headerIdx < 0) {
    errors.push("Expenses tab is missing a header row (Date, Category, Amount)");
  } else {
    const header = rows[headerIdx].map((h) => h.trim());
    const idCol = colIndex(header, "Id");
    const dateCol = colIndex(header, "Date");
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

      const date = /^\d{4}-\d{2}-\d{2}/.test(dateRaw)
        ? fromYmd(dateRaw)
        : parseFlexibleDate(dateRaw);
      const category = parseExpenseCategory(categoryRaw);
      const amount = parseMoney(amountRaw);

      if (!date) {
        errors.push(`Row ${rowNumber}: invalid date`);
        continue;
      }
      if (!category) {
        errors.push(`Row ${rowNumber}: unknown category "${categoryRaw}"`);
        continue;
      }
      if (amount == null || amount <= 0) {
        errors.push(`Row ${rowNumber}: amount must be greater than 0`);
        continue;
      }
      if (!description) {
        errors.push(`Row ${rowNumber}: description required`);
        continue;
      }

      const payment = mapPaymentMode(cell(row, modeCol));
      const paidBy = cell(row, paidCol) || null;
      const notes = cell(row, notesCol) || null;
      const data = {
        date,
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        category,
        description,
        amount,
        paymentMode: cell(row, modeCol) ? payment.mode : null,
        paidBy,
        notes,
      };

      try {
        if (id) {
          const existing = await prisma.gymExpense.findFirst({
            where: { id, gymId },
          });
          if (existing) {
            await prisma.gymExpense.update({
              where: { id },
              data: { ...data, updatedByUserId: triggeredBy },
            });
            updated.push(id);
            continue;
          }
        }

        const createdRow = await prisma.gymExpense.create({
          data: {
            ...data,
            gymId,
            createdByUserId: triggeredBy,
            source: "IMPORT",
          },
        });
        created.push(createdRow.id);
      } catch (err) {
        errors.push(
          `Row ${rowNumber}: ${err instanceof Error ? err.message : "save failed"}`
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
    sheetError = err instanceof Error ? err.message : "Failed to rewrite Expenses tab";
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
