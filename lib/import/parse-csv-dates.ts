import { fromYmd } from "@/lib/date-ymd";

/**
 * Parse flexible D/M/YYYY or DD/MM/YYYY dates from Google Sheet exports.
 * Day comes first (4/1/2026 is 4 January, not 1 April).
 * Uses noon local time to avoid timezone day-shift issues.
 */
export function parseFlexibleDate(input: string): Date | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

/** Google Sheets serial date: days since 1899-12-30. */
export function googleSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  const whole = Math.floor(serial);
  // 20000 ≈ 1954; ignore small numbers that are not real expense dates.
  if (whole < 20000 || whole > 80000) return null;
  const utc = new Date((whole - 25569) * 86400 * 1000);
  if (Number.isNaN(utc.getTime())) return null;
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), 12, 0, 0, 0);
}

/** Date cell from Sheets: DD/MM/YYYY text, ISO, or unformatted serial. */
export function parseSheetDate(input: unknown): Date | null {
  if (input == null || input === "") return null;
  if (typeof input === "number") return googleSerialToDate(input);
  const raw = String(input).trim();
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = googleSerialToDate(Number(raw));
    if (serial) return serial;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return fromYmd(raw);
  const dmy = parseFlexibleDate(raw);
  if (dmy) return dmy;
  return parseUsMonthDayYear(raw);
}

/** Only when the second number cannot be a month (13–31), e.g. Sheets US text 1/29/2026. */
export function parseUsMonthDayYear(input: string): Date | null {
  const match = input.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 13 || day > 31) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function formatDateDMY(date: Date): string {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}
