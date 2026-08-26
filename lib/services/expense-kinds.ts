import type { ExpenseCategory, ExpenseKind, UserRole } from "@prisma/client";

export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  OWNER_BILL: "Owner bill",
  SUPERVISOR_ADVANCE: "Cash given to supervisor",
  SUPERVISOR_SPEND: "Supervisor spend",
};

export const EXPENSE_KINDS = Object.keys(EXPENSE_KIND_LABELS) as ExpenseKind[];

export const PNL_EXPENSE_KINDS: ExpenseKind[] = ["OWNER_BILL", "SUPERVISOR_ADVANCE"];

export const OWNER_BILL_CATEGORIES: ExpenseCategory[] = [
  "RENT",
  "POWER_BILL",
  "SALARIES",
  "EQUIPMENT",
  "INTERNET",
  "PHONE",
  "REPAIRS",
  "MAINTENANCE",
  "SUPPLIES",
  "OTHERS",
];

export const ADVANCE_CATEGORIES: ExpenseCategory[] = ["MAINTENANCE", "REPAIRS"];

export const SUPERVISOR_SPEND_CATEGORIES: ExpenseCategory[] = [
  "REPAIRS",
  "MAINTENANCE",
  "SUPPLIES",
  "EQUIPMENT",
  "OTHERS",
];

const KIND_ALIASES: Record<string, ExpenseKind> = {
  "owner bill": "OWNER_BILL",
  "gym bill": "OWNER_BILL",
  bill: "OWNER_BILL",
  owner: "OWNER_BILL",
  "type 1": "OWNER_BILL",
  owner_bill: "OWNER_BILL",
  "cash given": "SUPERVISOR_ADVANCE",
  "cash given to supervisor": "SUPERVISOR_ADVANCE",
  "cash to supervisor": "SUPERVISOR_ADVANCE",
  advance: "SUPERVISOR_ADVANCE",
  "supervisor advance": "SUPERVISOR_ADVANCE",
  "petty cash": "SUPERVISOR_ADVANCE",
  float: "SUPERVISOR_ADVANCE",
  topup: "SUPERVISOR_ADVANCE",
  "top up": "SUPERVISOR_ADVANCE",
  supervisor_advance: "SUPERVISOR_ADVANCE",
  "supervisor spend": "SUPERVISOR_SPEND",
  spend: "SUPERVISOR_SPEND",
  "petty spend": "SUPERVISOR_SPEND",
  "type 2": "SUPERVISOR_SPEND",
  supervisor_spend: "SUPERVISOR_SPEND",
};

export function parseExpenseKind(input: string): ExpenseKind | null {
  const raw = input.trim();
  if (!raw) return null;
  const upper = raw.toUpperCase().replace(/\s+/g, "_");
  if (upper in EXPENSE_KIND_LABELS) return upper as ExpenseKind;
  const key = raw.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return KIND_ALIASES[key] ?? null;
}

export function countsTowardPnl(kind: ExpenseKind): boolean {
  return kind === "OWNER_BILL" || kind === "SUPERVISOR_ADVANCE";
}

export function categoriesForKind(kind: ExpenseKind): ExpenseCategory[] {
  switch (kind) {
    case "OWNER_BILL":
      return OWNER_BILL_CATEGORIES;
    case "SUPERVISOR_ADVANCE":
      return ADVANCE_CATEGORIES;
    case "SUPERVISOR_SPEND":
      return SUPERVISOR_SPEND_CATEGORIES;
  }
}

export function defaultCategoryForKind(kind: ExpenseKind): ExpenseCategory {
  switch (kind) {
    case "OWNER_BILL":
      return "RENT";
    case "SUPERVISOR_ADVANCE":
      return "MAINTENANCE";
    case "SUPERVISOR_SPEND":
      return "REPAIRS";
  }
}

export function defaultKindForRole(role: UserRole): ExpenseKind {
  return role === "SUPERVISOR" ? "SUPERVISOR_SPEND" : "OWNER_BILL";
}

export function isCategoryAllowedForKind(kind: ExpenseKind, category: ExpenseCategory): boolean {
  return categoriesForKind(kind).includes(category);
}

export function canCreateExpenseKind(role: UserRole, kind: ExpenseKind): boolean {
  if (role === "OWNER") return kind === "OWNER_BILL" || kind === "SUPERVISOR_ADVANCE";
  if (role === "SUPERVISOR") return kind === "SUPERVISOR_SPEND";
  return false;
}

export function canMutateExpenseKind(role: UserRole, kind: ExpenseKind): boolean {
  if (role === "OWNER") return true;
  if (role === "SUPERVISOR") return kind === "SUPERVISOR_SPEND";
  return false;
}

export function authorizeExpenseWrite(opts: {
  role: UserRole;
  action: "create" | "update" | "delete";
  requestedKind: ExpenseKind;
  existingKind?: ExpenseKind;
}): { ok: true } | { ok: false; status: 403 | 400; message: string } {
  if (opts.action === "create") {
    if (!canCreateExpenseKind(opts.role, opts.requestedKind)) {
      return { ok: false, status: 403, message: "You cannot add this type of expense" };
    }
    return { ok: true };
  }

  if (!opts.existingKind) {
    return { ok: false, status: 400, message: "Expense not found" };
  }
  if (!canMutateExpenseKind(opts.role, opts.existingKind)) {
    return { ok: false, status: 403, message: "You cannot change owner gym bills or cash given" };
  }
  if (
    opts.action === "update" &&
    opts.requestedKind !== opts.existingKind &&
    !canCreateExpenseKind(opts.role, opts.requestedKind)
  ) {
    return { ok: false, status: 403, message: "You cannot change this to an owner expense" };
  }
  return { ok: true };
}

export type AmountKindRow = { kind: ExpenseKind; amount: number };

export function sumPnlExpenses(rows: AmountKindRow[]): number {
  return rows.reduce((sum, row) => (countsTowardPnl(row.kind) ? sum + row.amount : sum), 0);
}

export function pettyCashFromRows(rows: AmountKindRow[]): {
  issued: number;
  spent: number;
  remaining: number;
} {
  let issued = 0;
  let spent = 0;
  for (const row of rows) {
    if (row.kind === "SUPERVISOR_ADVANCE") issued += row.amount;
    if (row.kind === "SUPERVISOR_SPEND") spent += row.amount;
  }
  return { issued, spent, remaining: issued - spent };
}

export class ExpenseWriteError extends Error {
  status: 400 | 403;
  constructor(status: 400 | 403, message: string) {
    super(message);
    this.status = status;
    this.name = "ExpenseWriteError";
  }
}
