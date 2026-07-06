"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { getMonthName } from "@/lib/permissions";
import { MonthYearPicker } from "@/components/reports/month-year-picker";

type PayrollRow = {
  employee: {
    id: string;
    employeeType: string;
    user: { name: string };
  };
  payroll: {
    id: string;
    month: number;
    year: number;
    baseSalary: number;
    commission: number;
    incentives: number;
    netPay: number;
    status: string;
    hasSnapshot?: boolean;
  } | null;
};

export function SalariesPanel({
  overview,
  month,
  year,
  canEdit,
  canPay,
  reportsPath = "/owner/reports",
}: {
  overview: PayrollRow[];
  month: number;
  year: number;
  canEdit: boolean;
  canPay: boolean;
  reportsPath?: string;
}) {
  const router = useRouter();

  async function generate() {
    await fetch("/api/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate", month, year }),
    });
    router.refresh();
  }

  async function markPaid(payrollRunId: string) {
    await fetch("/api/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pay", payrollRunId }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Salaries</h1>
          <p className="text-muted-foreground">
            {getMonthName(month)} {year} — base salary + PT commission
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Suspense fallback={null}>
            <MonthYearPicker month={month} year={year} />
          </Suspense>
          {canEdit && (
            <Button onClick={generate} className="min-h-11">
              Generate Payroll
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {overview.map(({ employee, payroll }) => (
          <Card key={employee.id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">{employee.user.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{employee.employeeType}</p>
              </div>
              <div className="flex items-center gap-2">
                {payroll?.hasSnapshot && (
                  <Badge variant="secondary">Snapshot locked</Badge>
                )}
                {payroll && (
                  <Badge variant={payroll.status === "PAID" ? "success" : "warning"}>
                    {payroll.status}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {payroll ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-muted-foreground">Base</p>
                      <p className="font-medium">{formatCurrency(payroll.baseSalary)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Commission</p>
                      <p className="font-medium">{formatCurrency(payroll.commission)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Incentives</p>
                      <p className="font-medium">{formatCurrency(payroll.incentives)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Net Pay</p>
                      <p className="font-bold">{formatCurrency(payroll.netPay)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {employee.employeeType === "TRAINER" && (
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`${reportsPath}?trainer=${employee.id}&month=${month}&year=${year}`}
                        >
                          PT Report
                        </Link>
                      </Button>
                    )}
                    <Button asChild variant="outline" size="sm">
                      <a href={`/api/payroll/${payroll.id}/pdf`} target="_blank" rel="noreferrer">
                        PDF
                      </a>
                    </Button>
                    {canPay && payroll.status === "PENDING" && (
                      <Button size="sm" onClick={() => markPaid(payroll.id)}>
                        Mark Paid
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Payroll not generated for this month.
                  </p>
                  {employee.employeeType === "TRAINER" && (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`${reportsPath}?trainer=${employee.id}&month=${month}&year=${year}`}
                      >
                        Preview PT Report
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function SchedulePanel({ trainerId }: { trainerId: string }) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  async function addSlot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const date = form.get("date") as string;
    const start = form.get("start") as string;
    const end = form.get("end") as string;

    await fetch("/api/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trainerId,
        startAt: `${date}T${start}:00`,
        endAt: `${date}T${end}:00`,
        isBlocked: form.get("isBlocked") === "on",
        label: form.get("label"),
      }),
    });
    router.refresh();
    (e.target as HTMLFormElement).reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Add Time Slot</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={addSlot} className="grid gap-3 sm:grid-cols-2">
          <Input name="date" type="date" defaultValue={today} required className="min-h-11" />
          <Input name="label" placeholder="Label (optional)" className="min-h-11" />
          <Input name="start" type="time" defaultValue="06:00" required className="min-h-11" />
          <Input name="end" type="time" defaultValue="07:00" required className="min-h-11" />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="isBlocked" />
            Block slot (unavailable)
          </label>
          <Button type="submit" className="sm:col-span-2 min-h-11">
            Add Slot
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
