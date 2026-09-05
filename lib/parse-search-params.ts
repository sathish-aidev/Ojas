/** Server-safe URL search param helpers (no "use client"). */

import { getGymToday, type YearMonth } from "@/lib/gym-calendar";

function paramString(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  const raw = searchParams[key];
  return typeof raw === "string" ? raw : raw?.[0];
}

export function parseMonthYearFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  prefix = "",
  fallback?: YearMonth
): { month: number; year: number } {
  const today = getGymToday();
  const def = fallback ?? { month: today.month, year: today.year };
  const monthRaw = paramString(searchParams, `${prefix}month`);
  const yearRaw = paramString(searchParams, `${prefix}year`);
  const month = monthRaw ? Number(monthRaw) : def.month;
  const year = yearRaw ? Number(yearRaw) : def.year;
  return {
    month: month >= 1 && month <= 12 ? month : def.month,
    year: year >= 2000 && year <= 2100 ? year : def.year,
  };
}

export function parseTrainerIdFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): string | undefined {
  const raw = searchParams.trainer;
  return typeof raw === "string" ? raw : raw?.[0];
}

export function parseShowAllFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): boolean {
  const raw = searchParams.all;
  const value = typeof raw === "string" ? raw : raw?.[0];
  return value === "1" || value === "true";
}
