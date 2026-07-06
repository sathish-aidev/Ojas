import { Suspense } from "react";
import { requireOwnerOrSupervisor } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getTrainerMonthlyReport } from "@/lib/services/trainer-monthly-report";
import { parseMonthYearFromSearchParams, parseTrainerIdFromSearchParams } from "@/lib/parse-search-params";
import { ReportsPageContent } from "@/components/reports/reports-page-content";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SupervisorReportsPage({ searchParams }: Props) {
  const user = await requireOwnerOrSupervisor();
  const params = await searchParams;
  const { month, year } = parseMonthYearFromSearchParams(params);

  const trainers = await prisma.employee.findMany({
    where: { gymId: user.gymId, employeeType: "TRAINER" },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });

  const trainerOptions = trainers.map((t) => ({ id: t.id, name: t.user.name }));
  const selectedTrainerId =
    parseTrainerIdFromSearchParams(params) || trainerOptions[0]?.id;

  const report = selectedTrainerId
    ? await getTrainerMonthlyReport(selectedTrainerId, month, year)
    : null;

  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <ReportsPageContent
        title="PT Reports"
        subtitle="Monthly client breakdown and trainer share (read-only)"
        trainers={trainerOptions}
        selectedTrainerId={selectedTrainerId ?? ""}
        report={report}
        month={month}
        year={year}
      />
    </Suspense>
  );
}
