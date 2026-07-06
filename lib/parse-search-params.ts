/** Server-safe URL search param helpers (no "use client"). */

export function parseMonthYearFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  prefix = ""
): { month: number; year: number } {
  const now = new Date();
  const monthRaw = searchParams[`${prefix}month`];
  const yearRaw = searchParams[`${prefix}year`];
  const month = monthRaw
    ? Number(Array.isArray(monthRaw) ? monthRaw[0] : monthRaw)
    : now.getMonth() + 1;
  const year = yearRaw
    ? Number(Array.isArray(yearRaw) ? yearRaw[0] : yearRaw)
    : now.getFullYear();
  return {
    month: month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    year: year >= 2000 && year <= 2100 ? year : now.getFullYear(),
  };
}

export function parseTrainerIdFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): string | undefined {
  const raw = searchParams.trainer;
  return typeof raw === "string" ? raw : raw?.[0];
}
