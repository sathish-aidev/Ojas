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

export const RECEIVED_FROM_CULT_LABEL = "Received from Cult";
export const RECEIVED_FROM_CULT_HINT = "Amount payable to gym partner (Partner Share)";

export const CULT_INCOME_SOURCE_LABELS = {
  partner_share: RECEIVED_FROM_CULT_LABEL,
  none: "Not entered",
} as const;

export type CultIncomeSource = keyof typeof CULT_INCOME_SOURCE_LABELS;

export function resolveCultIncome(input: {
  partnerShare: number | null;
}): { amount: number; source: CultIncomeSource; label: string } {
  if (input.partnerShare != null) {
    return {
      amount: input.partnerShare,
      source: "partner_share",
      label: CULT_INCOME_SOURCE_LABELS.partner_share,
    };
  }
  return { amount: 0, source: "none", label: CULT_INCOME_SOURCE_LABELS.none };
}

export const TDS_LABEL = "TDS";
export const TDS_HINT = "Withheld by Cult — subtracted in Net";
export const NET_FORMULA_LABEL =
  "Received from Cult − TDS + Total PT − expenses − paid payroll";

export type CultCashReceivedSource =
  | "cash_legs"
  | "partner_share_minus_rds"
  | "none";

function absAmount(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Math.abs(value);
}

export function resolveCultCashReceived(input: {
  centerCollections: number | null;
  midMonthPayment: number | null;
  grossPayable: number | null;
  partnerShare: number | null;
  tds: number | null;
  leasingEmi?: number | null;
  otherRecoveries?: number | null;
}): {
  moneyReceived: number | null;
  rds: number | null;
  leasingEmi: number | null;
  source: CultCashReceivedSource;
  label: string;
} {
  const rds = absAmount(input.tds);
  const leasingEmi = absAmount(input.leasingEmi) ?? 0;
  const otherRecoveries = absAmount(input.otherRecoveries) ?? 0;
  const extraRecoveries = leasingEmi + otherRecoveries;
  const legs = [
    absAmount(input.centerCollections),
    absAmount(input.midMonthPayment),
    absAmount(input.grossPayable),
  ];
  const allLegs = legs.every((value) => value != null);
  const anyLeg = legs.some((value) => value != null);
  const legsSum = allLegs ? legs.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
  const fromShare =
    input.partnerShare != null && rds != null ? input.partnerShare - rds - extraRecoveries : null;

  // Cash legs are the banked amounts (centre + mid-month + gross payable). Prefer them
  // whenever all three lines parsed, including a blank mid-month as 0. EMI and TDS are
  // already out of gross payable, so this matches the PDF even if a Less: line was missed.
  if (allLegs && legsSum != null) {
    return {
      moneyReceived: legsSum,
      rds,
      leasingEmi: leasingEmi || null,
      source: "cash_legs",
      label: extraRecoveries
        ? "Centre + mid-month + gross payable (TDS and leasing EMI excluded)"
        : "Centre + mid-month + gross payable",
    };
  }

  if (fromShare != null) {
    return {
      moneyReceived: fromShare,
      rds,
      leasingEmi: leasingEmi || null,
      source: "partner_share_minus_rds",
      label: extraRecoveries ? "Partner Share minus TDS and leasing EMI" : "Partner Share minus TDS",
    };
  }

  if (anyLeg) {
    const moneyReceived = legs.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    return {
      moneyReceived,
      rds,
      leasingEmi: leasingEmi || null,
      source: "cash_legs",
      label: "Centre + mid-month + gross payable (partial)",
    };
  }

  return {
    moneyReceived: null,
    rds,
    leasingEmi: leasingEmi || null,
    source: "none",
    label: "Not entered",
  };
}

/** Gym P&L: Received from Cult − TDS + Total PT − expenses − paid payroll. Blanks count as 0. */
export function resolveGymPnl(input: {
  receivedFromCult: number;
  tds: number;
  totalPt: number;
  expenses: number;
  payrollPaid: number;
}): { cultAfterTds: number; grossIncome: number; totalCosts: number; netResult: number } {
  const cultAfterTds = input.receivedFromCult - input.tds;
  const grossIncome = cultAfterTds + input.totalPt;
  const totalCosts = input.expenses + input.payrollPaid;
  return { cultAfterTds, grossIncome, totalCosts, netResult: grossIncome - totalCosts };
}

/** P&L Cult: typed Partner Share minus TDS. No tax-invoice fallback; leasing EMI is ignored. */
export function resolveCultPnlIncome(input: {
  partnerShare: number | null;
  tds: number | null;
}): {
  receivedFromCult: number | null;
  tds: number | null;
  amount: number;
  source: CultIncomeSource;
  label: string;
} {
  const receivedFromCult = input.partnerShare;
  const tds = input.tds == null ? null : Math.abs(input.tds);
  const amount = (receivedFromCult ?? 0) - (tds ?? 0);
  const cult = resolveCultIncome({ partnerShare: receivedFromCult });
  return {
    receivedFromCult,
    tds,
    amount,
    source: cult.source,
    label: cult.label,
  };
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
