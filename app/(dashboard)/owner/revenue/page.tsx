import { Suspense } from "react";
import { requireOwner } from "@/lib/session";
import { parseMonthYearFromSearchParams } from "@/lib/parse-search-params";
import { getMonthName } from "@/lib/permissions";
import {
  getRevenueMonthSummary,
  getRevenueTrend,
} from "@/lib/services/revenue-summary";
import { scanCultInvoicesFromDrive } from "@/lib/services/cult-drive-sync";
import { MonthYearPicker } from "@/components/reports/month-year-picker";
import { RevenueDashboard } from "@/components/revenue/revenue-dashboard";
import { CultSettlementForm } from "@/components/revenue/cult-settlement-form";
import { SheetSyncActions } from "@/components/sync/sheet-sync-actions";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function OwnerRevenuePage({ searchParams }: Props) {
  const user = await requireOwner();
  const params = await searchParams;
  const { month, year } = parseMonthYearFromSearchParams(params);

  const scan = await scanCultInvoicesFromDrive(user.gymId, user.id).catch((err: unknown) => ({
    error: err instanceof Error ? err.message : "Could not read Drive invoices",
    folders: null as null,
    files: [],
    linked: 0,
    parsed: 0,
    unmatched: [],
    warnings: [] as string[],
  }));

  const [summary, trend] = await Promise.all([
    getRevenueMonthSummary(user.gymId, month, year),
    getRevenueTrend(user.gymId, month, year),
  ]);

  const folderLinks = scan.folders
    ? {
        cultInvoicesUrl: scan.folders.cultInvoicesUrl,
        settlementUrl: scan.folders.settlementUrl,
        taxInvoiceUrl: scan.folders.taxInvoiceUrl,
      }
    : null;
  const folderError = "error" in scan ? scan.error : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Monthly revenue</h1>
          <p className="text-muted-foreground">
            {getMonthName(month)} {year} — actual Cult money received + owner PT share − expenses − paid
            payroll. RDS is not added to income.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SheetSyncActions compact />
          <Suspense fallback={null}>
            <MonthYearPicker month={month} year={year} enableShowAll={false} />
          </Suspense>
        </div>
      </div>

      <RevenueDashboard
        summary={summary}
        trend={trend}
        salariesPath="/owner/salaries"
        reportsPath="/owner/reports"
        expensesPath="/owner/expenses"
      />

      <CultSettlementForm
        month={month}
        year={year}
        settlement={summary.settlement}
        folders={folderLinks}
        folderError={folderError}
        driveFiles={scan.files}
        scanWarnings={scan.warnings}
        scanSummary={
          !folderError && scan.linked > 0
            ? `Loaded ${scan.linked} Drive file(s)${scan.parsed ? `, read ${scan.parsed} PDF(s)` : ""}.`
            : null
        }
      />
    </div>
  );
}
