import type { PaymentMode } from "@prisma/client";

export type MappedPaymentMode = {
  mode: PaymentMode;
  notes: string;
};

/** Map free-text payment mode from sheet → enum; keep full text in notes. */
export function mapPaymentMode(text: string): MappedPaymentMode {
  const notes = text.trim();
  const lower = notes.toLowerCase();

  if (!notes) {
    return { mode: "OTHER", notes: "" };
  }

  if (/\b(cash|given to)\b/.test(lower)) {
    return { mode: "CASH", notes };
  }
  if (/\b(upi|phone\s*pe|phonepe|phone\s*pay|gpay|google\s*pay|paytm|bhim)\b/.test(lower)) {
    return { mode: "UPI", notes };
  }
  if (/\b(card|debit|credit|visa|mastercard)\b/.test(lower)) {
    return { mode: "CARD", notes };
  }
  if (/\b(bank|neft|rtgs|transfer|imps)\b/.test(lower)) {
    return { mode: "BANK_TRANSFER", notes };
  }

  return { mode: "OTHER", notes };
}
