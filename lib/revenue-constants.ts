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
  EQUIPMENT: "Equipment",
  TDS: "TDS",
  GST: "GST",
  CA_FEE: "CA fee",
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
  equipment: "EQUIPMENT",
  equip: "EQUIPMENT",
  machines: "EQUIPMENT",
  tds: "TDS",
  gst: "GST",
  "ca fee": "CA_FEE",
  "ca fees": "CA_FEE",
  ca: "CA_FEE",
  "chartered accountant": "CA_FEE",
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

export const RDS_LABEL = "RDS";
export const RDS_HINT = "Withheld by Cult — not added to income";

export type CultCashReceivedSource = "cash_legs" | "partner_share_minus_rds" | "none";

export function resolveCultCashReceived(input: {
  centerCollections: number | null;
  midMonthPayment: number | null;
  grossPayable: number | null;
  partnerShare: number | null;
  tds: number | null;
}): {
  moneyReceived: number | null;
  rds: number | null;
  source: CultCashReceivedSource;
  label: string;
} {
  const rds = input.tds;
  const legs = [input.centerCollections, input.midMonthPayment, input.grossPayable];
  const allLegs = legs.every((value) => value != null);
  const anyLeg = legs.some((value) => value != null);

  if (allLegs) {
    const moneyReceived = legs.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    return {
      moneyReceived,
      rds,
      source: "cash_legs",
      label: "Centre + mid-month + gross payable",
    };
  }

  if (input.partnerShare != null && rds != null) {
    return {
      moneyReceived: input.partnerShare - rds,
      rds,
      source: "partner_share_minus_rds",
      label: "Partner Share minus RDS",
    };
  }

  if (anyLeg) {
    const moneyReceived = legs.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    return {
      moneyReceived,
      rds,
      source: "cash_legs",
      label: "Centre + mid-month + gross payable (partial)",
    };
  }

  return { moneyReceived: null, rds, source: "none", label: "Not entered" };
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
