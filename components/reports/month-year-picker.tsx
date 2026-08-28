"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getMonthName } from "@/lib/permissions";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const CURRENT_YEAR = new Date().getFullYear();

export function MonthYearPicker({
  month,
  year,
  showAll = false,
  paramPrefix = "",
  enableShowAll = true,
  minYear,
}: {
  month: number;
  year: number;
  showAll?: boolean;
  paramPrefix?: string;
  enableShowAll?: boolean;
  minYear?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const startYear = minYear ?? CURRENT_YEAR - 5;
  const years = Array.from(
    { length: Math.max(1, CURRENT_YEAR + 2 - startYear + 1) },
    (_, i) => startYear + i
  );

  function pushParams(next: URLSearchParams) {
    router.push(`${pathname}?${next.toString()}`);
  }

  function updateMonthYear(nextMonth: number, nextYear: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(`${paramPrefix}month`, String(nextMonth));
    params.set(`${paramPrefix}year`, String(nextYear));
    params.delete("all");
    pushParams(params);
  }

  function toggleShowAll() {
    const params = new URLSearchParams(searchParams.toString());
    if (showAll) {
      params.delete("all");
    } else {
      params.set("all", "1");
    }
    pushParams(params);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!showAll && (
        <>
          <select
            value={month}
            onChange={(e) => updateMonthYear(Number(e.target.value), year)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
            aria-label="Month"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {getMonthName(m)}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => updateMonthYear(month, Number(e.target.value))}
            className="h-10 rounded-md border bg-background px-3 text-sm"
            aria-label="Year"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </>
      )}
      {enableShowAll && (
        <Button
          type="button"
          variant={showAll ? "default" : "outline"}
          size="sm"
          className="min-h-10"
          onClick={toggleShowAll}
        >
          {showAll ? `Showing all PTs` : "Show all"}
        </Button>
      )}
    </div>
  );
}
