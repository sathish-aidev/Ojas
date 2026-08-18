import { Suspense } from "react";
import { requireOwnerOrSupervisor } from "@/lib/session";
import { parseMonthYearFromSearchParams } from "@/lib/parse-search-params";
import { getMonthName } from "@/lib/permissions";
import {
  getExpenseDashboard,
  listExpenses,
  prepareExpenseSheet,
} from "@/lib/services/expenses";
import { MonthYearPicker } from "@/components/reports/month-year-picker";
import { ExpensesWorkspace } from "@/components/expenses/expenses-workspace";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function SupervisorExpensesPage({ searchParams }: Props) {
  const user = await requireOwnerOrSupervisor();
  const params = await searchParams;
  const { month, year } = parseMonthYearFromSearchParams(params);
  const [dashboard, monthExpenses, yearExpenses, sheet] = await Promise.all([
    getExpenseDashboard(user.gymId, month, year),
    listExpenses(user.gymId, month, year),
    listExpenses(user.gymId, undefined, year),
    prepareExpenseSheet(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">
            {getMonthName(month)} {year} — gym costs, trends, and the Expenses sheet
          </p>
        </div>
        <Suspense fallback={null}>
          <MonthYearPicker month={month} year={year} enableShowAll={false} />
        </Suspense>
      </div>
      <ExpensesWorkspace
        monthLabel={`${getMonthName(month)} ${year}`}
        dashboard={dashboard}
        monthExpenses={monthExpenses}
        yearExpenses={yearExpenses}
        sheetUrl={sheet.spreadsheetUrl}
        sheetError={sheet.error}
      />
    </div>
  );
}
