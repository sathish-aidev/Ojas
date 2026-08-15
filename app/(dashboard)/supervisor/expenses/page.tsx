import { Suspense } from "react";
import { requireOwnerOrSupervisor } from "@/lib/session";
import { parseMonthYearFromSearchParams } from "@/lib/parse-search-params";
import { getMonthName } from "@/lib/permissions";
import { listExpenses } from "@/lib/services/expenses";
import { MonthYearPicker } from "@/components/reports/month-year-picker";
import { ExpensesPanel } from "@/components/revenue/expenses-panel";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SupervisorExpensesPage({ searchParams }: Props) {
  const user = await requireOwnerOrSupervisor();
  const params = await searchParams;
  const { month, year } = parseMonthYearFromSearchParams(params);
  const expenses = await listExpenses(user.gymId, month, year);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gym expenses</h1>
          <p className="text-muted-foreground">
            {getMonthName(month)} {year} — add, edit, or sync from the Expenses Google Sheet
          </p>
        </div>
        <Suspense fallback={null}>
          <MonthYearPicker month={month} year={year} enableShowAll={false} />
        </Suspense>
      </div>
      <ExpensesPanel expenses={expenses} monthLabel={`${getMonthName(month)} ${year}`} />
    </div>
  );
}
