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
import { clampToGymStart, GYM_START_YEAR, defaultClosedViewMonth } from "@/lib/gym-calendar";
import { NET_FORMULA_LABEL } from "@/lib/revenue-constants";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export default async function OwnerRevenuePage({ searchParams }: Props) {
  const user = await requireOwner();
  const params = await searchParams;
  const selected = parseMonthYearFromSearchParams(params, "", defaultClosedViewMonth());
  const { month, year } = clampToGymStart(selected.month, selected.year);

  const scan = await scanCultInvoicesFromDrive(user.gymId, user.id, { parsePdfs: false }).catch((err: unknown) => ({
    error: err instanceof Error ? err.message : "Could not read Drive invoices",
    folders: null as null,
    files: [],
    linked: 0,
    parsed: 0,
    unmatched: [],
    warnings: [] as string[],
    processed: [] as Array<{ month: number; year: number }>,
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
            {getMonthName(month)} {year} — {NET_FORMULA_LABEL}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SheetSyncActions compact />
          <Suspense fallback={null}>
            <MonthYearPicker month={month} year={year} enableShowAll={false} minYear={GYM_START_YEAR} />
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
            ? `Linked ${scan.linked} Drive file(s). Enter Received from Cult and TDS yourself.`
            : null
        }
      />
    </div>
  );
}
