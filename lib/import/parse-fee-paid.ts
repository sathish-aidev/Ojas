import { parseFlexibleDate } from "./parse-csv-dates";

export type FeePaidResult = {
  paymentDate: Date;
  usedStartDateFallback: boolean;
};

/**
 * Parse "Fee paid on" cell: plain date, "yes DD/MM/YYYY", "advance payment yes DD/MM/YYYY",
 * or plain "yes" → fall back to start date.
 */
export function parseFeePaidOn(raw: string, startDate: Date): FeePaidResult {
  const trimmed = raw.trim();

  if (!trimmed) {
    return { paymentDate: startDate, usedStartDateFallback: true };
  }

  const direct = parseFlexibleDate(trimmed);
  if (direct) {
    return { paymentDate: direct, usedStartDateFallback: false };
  }

  const dateInText = trimmed.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{4})/);
  if (dateInText) {
    const parsed = parseFlexibleDate(dateInText[1]);
    if (parsed) {
      return { paymentDate: parsed, usedStartDateFallback: false };
    }
  }

  if (/^yes\b/i.test(trimmed) || /\byes\b/i.test(trimmed)) {
    return { paymentDate: startDate, usedStartDateFallback: true };
  }

  return { paymentDate: startDate, usedStartDateFallback: true };
}
