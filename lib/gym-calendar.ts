import { shiftMonth } from "@/lib/date-ymd";

/** Impackt gym operations start — month pickers and revenue trend never go earlier. */
export const GYM_START_MONTH = 1;
export const GYM_START_YEAR = 2026;

/** Cult, rent, and power for month M are typically entered by this day of M+1. */
export const BOOKS_CLOSE_DAY = 10;

export type YearMonth = { month: number; year: number };

export function isBeforeGymStart(month: number, year: number): boolean {
  return year < GYM_START_YEAR || (year === GYM_START_YEAR && month < GYM_START_MONTH);
}

export function clampToGymStart(month: number, year: number): { month: number; year: number } {
  if (isBeforeGymStart(month, year)) {
    return { month: GYM_START_MONTH, year: GYM_START_YEAR };
  }
  return { month, year };
}

/** Inclusive months from gym start through the selected month. */
export function monthsFromGymStartThrough(
  month: number,
  year: number
): Array<{ month: number; year: number }> {
  const end = clampToGymStart(month, year);
  const keys: Array<{ month: number; year: number }> = [];
  let cursor = { month: GYM_START_MONTH, year: GYM_START_YEAR };
  while (cursor.year < end.year || (cursor.year === end.year && cursor.month <= end.month)) {
    keys.push(cursor);
    cursor = shiftMonth(cursor.month, cursor.year, 1);
  }
  return keys;
}

export function monthOrdinal(month: number, year: number) {
  return year * 12 + month;
}

export function isMonthOnOrBefore(a: YearMonth, b: YearMonth) {
  return monthOrdinal(a.month, a.year) <= monthOrdinal(b.month, b.year);
}

export function maxYearMonth(a: YearMonth | null, b: YearMonth | null): YearMonth | null {
  if (!a) return b;
  if (!b) return a;
  return monthOrdinal(a.month, a.year) >= monthOrdinal(b.month, b.year) ? a : b;
}

/** Calendar date in the gym timezone (IST). */
export function getGymToday(now = new Date(), timeZone = "Asia/Kolkata"): YearMonth & { day: number } {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [year, month, day] = ymd.split("-").map(Number);
  return { year, month, day };
}

/** Latest month whose books can already be closed — never the current calendar month. */
export function lastCompletableMonth(today: YearMonth): YearMonth {
  const previous = shiftMonth(today.month, today.year, -1);
  return clampToGymStart(previous.month, previous.year);
}

/**
 * Home P&L month: latest Cult settlement at or before last calendar month.
 * If Cult is not in yet, fall back to the latest month with expenses/PT, then last calendar month.
 */
export function pickClosedBooksMonth(input: {
  today: YearMonth;
  latestCult: YearMonth | null;
  latestActivity: YearMonth | null;
}): { books: YearMonth; due: YearMonth | null } {
  const cap = lastCompletableMonth(input.today);
  const cult =
    input.latestCult && isMonthOnOrBefore(input.latestCult, cap)
      ? clampToGymStart(input.latestCult.month, input.latestCult.year)
      : null;
  const activity =
    input.latestActivity && isMonthOnOrBefore(input.latestActivity, cap)
      ? clampToGymStart(input.latestActivity.month, input.latestActivity.year)
      : null;
  const books = cult ?? activity ?? cap;
  const nextOpen = shiftMonth(books.month, books.year, 1);
  const due =
    monthOrdinal(books.month, books.year) < monthOrdinal(cap.month, cap.year)
      ? clampToGymStart(nextOpen.month, nextOpen.year)
      : null;
  return { books, due };
}

export function booksCloseBy(due: YearMonth): YearMonth & { day: number } {
  const next = shiftMonth(due.month, due.year, 1);
  return { ...next, day: BOOKS_CLOSE_DAY };
}

export function isBooksOverdue(today: YearMonth & { day: number }, due: YearMonth): boolean {
  const close = booksCloseBy(due);
  const todayOrd = monthOrdinal(today.month, today.year);
  const closeOrd = monthOrdinal(close.month, close.year);
  if (todayOrd > closeOrd) return true;
  if (todayOrd < closeOrd) return false;
  return today.day > close.day;
}

export function formatMonthYear(month: number, year: number) {
  const name = new Date(2000, month - 1, 1).toLocaleString("en-IN", { month: "long" });
  return `${name} ${year}`;
}

export function formatCloseByLabel(due: YearMonth) {
  const close = booksCloseBy(due);
  const name = new Date(2000, close.month - 1, 1).toLocaleString("en-IN", { month: "long" });
  return `${close.day} ${name}`;
}
