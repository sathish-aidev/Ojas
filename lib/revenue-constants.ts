import type { ExpenseCategory, PaymentMode } from "@prisma/client";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  RENT: "Rent",
  POWER_BILL: "Power Bill",
  REPAIRS: "Repairs",
  SUPPLIES: "Supplies",
  INTERNET: "Internet",
  PHONE: "Phone",
  SALARIES: "Salaries",
  MAINTENANCE: "Maintenance",
  OTHERS: "Others",
};

export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

const CATEGORY_ALIASES: Record<string, ExpenseCategory> = {
  rent: "RENT",
  "power bill": "POWER_BILL",
  powerbill: "POWER_BILL",
  power_bill: "POWER_BILL",
  electricity: "POWER_BILL",
  eb: "POWER_BILL",
  repairs: "REPAIRS",
  repair: "REPAIRS",
  supplies: "SUPPLIES",
  supply: "SUPPLIES",
  internet: "INTERNET",
  wifi: "INTERNET",
  phone: "PHONE",
  mobile: "PHONE",
  salaries: "SALARIES",
  salary: "SALARIES",
  payroll: "SALARIES",
  maintenance: "MAINTENANCE",
  maint: "MAINTENANCE",
  others: "OTHERS",
  other: "OTHERS",
  misc: "OTHERS",
};

export function parseExpenseCategory(input: string): ExpenseCategory | null {
  const key = input.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!key) return null;
  const upper = input.trim().toUpperCase().replace(/\s+/g, "_");
  if (upper in EXPENSE_CATEGORY_LABELS) return upper as ExpenseCategory;
  return CATEGORY_ALIASES[key] ?? null;
}

export const CULT_INCOME_SOURCE_LABELS = {
  partner_share: "Partner Share",
  tax_invoice: "Tax Invoice Gross Total",
  none: "Not entered",
} as const;

export type CultIncomeSource = keyof typeof CULT_INCOME_SOURCE_LABELS;

export function resolveCultIncome(input: {
  partnerShare: number | null;
  taxInvoiceGrossTotal: number | null;
}): { amount: number; source: CultIncomeSource; label: string } {
  if (input.partnerShare != null) {
    return {
      amount: input.partnerShare,
      source: "partner_share",
      label: CULT_INCOME_SOURCE_LABELS.partner_share,
    };
  }
  if (input.taxInvoiceGrossTotal != null) {
    return {
      amount: input.taxInvoiceGrossTotal,
      source: "tax_invoice",
      label: CULT_INCOME_SOURCE_LABELS.tax_invoice,
    };
  }
  return { amount: 0, source: "none", label: CULT_INCOME_SOURCE_LABELS.none };
}

export function paymentModeLabel(mode: PaymentMode | null | undefined): string {
  if (!mode) return "";
  return {
    CASH: "Cash",
    UPI: "UPI",
    CARD: "Card",
    BANK_TRANSFER: "Bank Transfer",
    OTHER: "Other",
  }[mode];
}
