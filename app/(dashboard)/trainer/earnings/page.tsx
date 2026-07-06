import { Suspense } from "react";
import { requireTrainer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getTrainerMonthlyReport } from "@/lib/services/trainer-monthly-report";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrainerMonthlyReportTable } from "@/components/reports/trainer-monthly-report-table";
import { MonthYearPicker } from "@/components/reports/month-year-picker";
import { parseMonthYearFromSearchParams } from "@/lib/parse-search-params";
import { formatCurrency, decimalToNumber } from "@/lib/utils";
import { getMonthName } from "@/lib/permissions";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TrainerEarningsPage({ searchParams }: Props) {
  const user = await requireTrainer();
  if (!user.employeeId) return null;

  const params = await searchParams;
  const { month, year } = parseMonthYearFromSearchParams(params);

  const [report, payrollHistory] = await Promise.all([
    getTrainerMonthlyReport(user.employeeId, month, year),
    prisma.payrollRun.findMany({
      where: { employeeId: user.employeeId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 12,
    }),
  ]);

  if (!report) return null;

  const { trainer, summary } = report;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Earnings</h1>
          <p className="text-muted-foreground">
            {trainer.activeSplitPercent}% split
            {trainer.hasTarget && trainer.monthlyTarget
              ? ` · ${formatCurrency(summary.totalPtRevenue)} / ${formatCurrency(trainer.monthlyTarget)} target`
              : ""}
            {trainer.targetMet ? " · Target met!" : ""}
            {" · "}Base {formatCurrency(trainer.baseSalary)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Suspense fallback={null}>
            <MonthYearPicker month={month} year={year} />
          </Suspense>
          <Button asChild variant="outline" size="sm">
            <a
              href={`/api/reports/trainer/pdf?month=${month}&year=${year}`}
              target="_blank"
              rel="noreferrer"
            >
              Export PDF
            </a>
          </Button>
        </div>      </div>

      <div className="grid gap-4 grid-cols-2">
        <StatCard title="PT Revenue" value={formatCurrency(summary.totalPtRevenue)} />
        <StatCard title="Your Share" value={formatCurrency(summary.totalTrainerShare)} highlight />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {getMonthName(month)} {year} — Client Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TrainerMonthlyReportTable report={report} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payroll History (12 months)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {payrollHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payroll records yet.</p>
          ) : (
            payrollHistory.map((run) => (
              <div
                key={run.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm"
              >
                <span>
                  {getMonthName(run.month)} {run.year} · {run.status}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatCurrency(decimalToNumber(run.netPay))}</span>
                  {run.status === "PAID" && (
                    <a
                      href={`/api/payroll/${run.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline text-xs"
                    >
                      PDF
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
