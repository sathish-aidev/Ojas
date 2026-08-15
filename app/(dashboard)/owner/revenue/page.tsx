import { Suspense } from "react";
import { requireOwner } from "@/lib/session";
import { parseMonthYearFromSearchParams } from "@/lib/parse-search-params";
import { getMonthName } from "@/lib/permissions";
import {
  getRevenueMonthSummary,
  getRevenueTrend,
} from "@/lib/services/revenue-summary";
import { listExpenses } from "@/lib/services/expenses";
import { ensureCultInvoiceFolders } from "@/lib/google/drive-archive";
import { MonthYearPicker } from "@/components/reports/month-year-picker";
import { RevenueDashboard } from "@/components/revenue/revenue-dashboard";
import { CultSettlementForm } from "@/components/revenue/cult-settlement-form";
import { ExpensesPanel } from "@/components/revenue/expenses-panel";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const maxDuration = 60;

export default async function OwnerRevenuePage({ searchParams }: Props) {
  const user = await requireOwner();
  const params = await searchParams;
  const { month, year } = parseMonthYearFromSearchParams(params);

  const [summary, trend, expenses, folders] = await Promise.all([
    getRevenueMonthSummary(user.gymId, month, year),
    getRevenueTrend(user.gymId, month, year),
    listExpenses(user.gymId, month, year),
    ensureCultInvoiceFolders().catch((err: unknown) => ({
      error: err instanceof Error ? err.message : "Could not create Drive folders",
    })),
  ]);

  const folderLinks =
    folders && "settlementUrl" in folders
      ? {
          cultInvoicesUrl: folders.cultInvoicesUrl,
          settlementUrl: folders.settlementUrl,
          taxInvoiceUrl: folders.taxInvoiceUrl,
        }
      : null;
  const folderError = folders && "error" in folders ? folders.error : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Monthly revenue</h1>
          <p className="text-muted-foreground">
            {getMonthName(month)} {year} — Cult partner share + owner PT share − expenses − paid
            payroll
          </p>
        </div>
        <Suspense fallback={null}>
          <MonthYearPicker month={month} year={year} enableShowAll={false} />
        </Suspense>
      </div>

      <RevenueDashboard
        summary={summary}
        trend={trend}
        salariesPath="/owner/salaries"
        reportsPath="/owner/reports"
        expensesPath="#expenses"
      />

      <CultSettlementForm
        month={month}
        year={year}
        settlement={summary.settlement}
        folders={folderLinks}
        folderError={folderError}
      />

      <div id="expenses">
        <ExpensesPanel expenses={expenses} monthLabel={`${getMonthName(month)} ${year}`} />
      </div>
    </div>
  );
}
