"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { getMonthName } from "@/lib/permissions";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

export function MonthYearPicker({
  month,
  year,
  paramPrefix = "",
}: {
  month: number;
  year: number;
  paramPrefix?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(nextMonth: number, nextYear: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(`${paramPrefix}month`, String(nextMonth));
    params.set(`${paramPrefix}year`, String(nextYear));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={month}
        onChange={(e) => update(Number(e.target.value), year)}
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
        onChange={(e) => update(month, Number(e.target.value))}
        className="h-10 rounded-md border bg-background px-3 text-sm"
        aria-label="Year"
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
