import { Suspense } from "react";
import { requireOwnerOrSupervisor } from "@/lib/session";
import { getSalariesOverview } from "@/lib/services/salaries";
import { SalariesPanel } from "@/components/salaries/salaries-panel";
import { parseMonthYearFromSearchParams } from "@/lib/parse-search-params";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SupervisorSalariesPage({ searchParams }: Props) {
  const user = await requireOwnerOrSupervisor();
  const params = await searchParams;
  const { month, year } = parseMonthYearFromSearchParams(params);
  const overview = await getSalariesOverview(user.gymId, month, year);

  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <SalariesPanel
        overview={overview}
        month={month}
        year={year}
        canEdit={false}
        canPay
        reportsPath="/supervisor/reports"
      />
    </Suspense>
  );
}
