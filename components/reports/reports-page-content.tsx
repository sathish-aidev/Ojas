import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";import { TrainerMonthlyReportTable } from "@/components/reports/trainer-monthly-report-table";
import { MonthYearPicker } from "@/components/reports/month-year-picker";
import { TrainerSelector } from "@/components/reports/trainer-selector";
import type { TrainerMonthlyReport } from "@/lib/services/trainer-monthly-report";

type TrainerOption = { id: string; name: string };

function ReportsToolbar({
  trainers,
  selectedTrainerId,
  month,
  year,
}: {
  trainers: TrainerOption[];
  selectedTrainerId: string;
  month: number;
  year: number;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <TrainerSelector trainers={trainers} selectedId={selectedTrainerId} />
      <Suspense fallback={null}>
        <MonthYearPicker month={month} year={year} />
      </Suspense>
    </div>
  );
}

export function ReportsPageContent({
  title,
  subtitle,
  trainers,
  selectedTrainerId,
  report,
  month,
  year,
}: {
  title: string;
  subtitle: string;
  trainers: TrainerOption[];
  selectedTrainerId: string;
  report: TrainerMonthlyReport | null;
  month: number;
  year: number;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>

      <Suspense fallback={null}>
        <ReportsToolbar
          trainers={trainers}
          selectedTrainerId={selectedTrainerId}
          month={month}
          year={year}
        />
      </Suspense>

      {report ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">{report.trainer.name} — PT Report</CardTitle>
            <Button asChild variant="outline" size="sm">
              <a
                href={`/api/reports/trainer/pdf?trainerId=${selectedTrainerId}&month=${month}&year=${year}`}
                target="_blank"
                rel="noreferrer"
              >
                Export PDF
              </a>
            </Button>
          </CardHeader>          <CardContent>
            <TrainerMonthlyReportTable report={report} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No report data for this trainer.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
