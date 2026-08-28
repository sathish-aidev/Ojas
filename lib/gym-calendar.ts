import { shiftMonth } from "@/lib/date-ymd";

/** Impackt gym operations start — month pickers and revenue trend never go earlier. */
export const GYM_START_MONTH = 1;
export const GYM_START_YEAR = 2026;

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
