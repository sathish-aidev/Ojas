import { Suspense } from "react";
import { requireOwnerOrSupervisor } from "@/lib/session";
import { getSalariesOverview } from "@/lib/services/salaries";
import { getSheetSyncRuns } from "@/lib/services/sheet-sync";
import { SalariesPanel } from "@/components/salaries/salaries-panel";
import { SheetSyncPanel } from "@/components/sync/sheet-sync-panel";
import { parseMonthYearFromSearchParams } from "@/lib/parse-search-params";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SupervisorSalariesPage({ searchParams }: Props) {
  const user = await requireOwnerOrSupervisor();
  const params = await searchParams;
  const { month, year } = parseMonthYearFromSearchParams(params);
  const [overview, syncRuns] = await Promise.all([
    getSalariesOverview(user.gymId, month, year),
    getSheetSyncRuns(user.gymId, 10),
  ]);

  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <div className="space-y-6">
        <SalariesPanel
          overview={overview}
          month={month}
          year={year}
          canEdit={false}
          canPay
          canSync
          reportsPath="/supervisor/reports"
        />
        <SheetSyncPanel
          runs={syncRuns.map((r) => ({
            id: r.id,
            status: r.status,
            source: r.source,
            createdAt: r.createdAt.toISOString(),
            summary: r.summary as {
              totalCreated?: number;
              totalUpdated?: number;
              totalErrors?: number;
              type?: string;
              method?: string;
              fileUrl?: string | null;
              folderUrl?: string;
              driveError?: string | null;
              tabNames?: string[];
              tabs?: Array<{
                tabName: string;
                created: number;
                updated: number;
                errors: string[];
              }>;
            },
          }))}
          canRestore={false}
        />
      </div>
    </Suspense>
  );
}
