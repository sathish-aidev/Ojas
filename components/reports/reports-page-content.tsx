import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { TrainerMonthlyReportTable } from "@/components/reports/trainer-monthly-report-table";

import { MonthYearPicker } from "@/components/reports/month-year-picker";

import { TrainerSelector } from "@/components/reports/trainer-selector";
import { SheetSyncActions } from "@/components/sync/sheet-sync-actions";
import type { TrainerMonthlyReport } from "@/lib/services/trainer-monthly-report";



type TrainerOption = { id: string; name: string };



function ReportsToolbar({

  trainers,

  selectedTrainerId,

  month,

  year,

  showAll,

}: {

  trainers: TrainerOption[];

  selectedTrainerId: string;

  month: number;

  year: number;

  showAll: boolean;

}) {

  return (

    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <TrainerSelector trainers={trainers} selectedId={selectedTrainerId} />
      <div className="flex flex-wrap items-center gap-2">
        <SheetSyncActions compact />
        <Suspense fallback={null}>
          <MonthYearPicker month={month} year={year} showAll={showAll} />
        </Suspense>
      </div>
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

  showAll = false,

}: {

  title: string;

  subtitle: string;

  trainers: TrainerOption[];

  selectedTrainerId: string;

  report: TrainerMonthlyReport | null;

  month: number;

  year: number;

  showAll?: boolean;

}) {

  const pdfHref = showAll

    ? `/api/reports/trainer/pdf?trainerId=${selectedTrainerId}&all=1`

    : `/api/reports/trainer/pdf?trainerId=${selectedTrainerId}&month=${month}&year=${year}`;



  return (

    <div className="space-y-6">

      <div>

        <h1 className="text-2xl font-bold">{title}</h1>

        <p className="text-muted-foreground">{subtitle}</p>

        {showAll && (

          <p className="mt-1 text-sm text-amber-700">

            Showing every PT package for this trainer (sorted by start date). Use Sync sheets in
            the header to pull sheet changes into the app.

          </p>

        )}

      </div>



      <Suspense fallback={null}>

        <ReportsToolbar

          trainers={trainers}

          selectedTrainerId={selectedTrainerId}

          month={month}

          year={year}

          showAll={showAll}

        />

      </Suspense>



      {report ? (

        <Card>

          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <CardTitle className="text-lg">

              {report.trainer.name} — {showAll ? "All PT Packages" : "PT Report"}

            </CardTitle>

            <Button asChild variant="outline" size="sm" className="min-h-11 w-full sm:w-auto">

              <a href={pdfHref} target="_blank" rel="noreferrer">

                Export PDF

              </a>

            </Button>

          </CardHeader>

          <CardContent>

            <TrainerMonthlyReportTable report={report} showAll={showAll} />

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

