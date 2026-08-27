"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatCurrency } from "@/lib/utils";
import { RDS_HINT, RDS_LABEL } from "@/lib/revenue-constants";
import type { RevenueMonthSummary } from "@/lib/services/revenue-summary";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type TrendPoint = {
  month: number;
  year: number;
  label: string;
  cultIncome: number;
  cultIncomeSource: "partner_share" | "tax_invoice" | "none";
  ownerPtShare: number;
  rds: number | null;
  moneyReceived: number | null;
  usedMoneyReceived: boolean;
  manualExpenses: number;
  payrollPaid: number;
  totalCosts: number;
  grossIncome: number;
  netResult: number;
};

function inr(value: number) {
  return formatCurrency(value);
}

export function RevenueDashboard({
  summary,
  trend,
  salariesPath,
  reportsPath,
  expensesPath,
}: {
  summary: RevenueMonthSummary;
  trend: TrendPoint[];
  salariesPath: string;
  reportsPath: string;
  expensesPath: string;
}) {
  const maxExpense = Math.max(1, ...summary.expensesByCategory.map((c) => c.amount));
  const showCash =
    summary.moneyReceived != null ||
    summary.rds != null ||
    summary.settlement?.centerCollections != null ||
    summary.settlement?.midMonthPayment != null ||
    summary.settlement?.grossPayable != null;
  const cultSubtitle = summary.usedMoneyReceived
    ? summary.partnerShare != null
      ? `Partner Share ${inr(summary.partnerShare)} · ${RDS_LABEL} is not added to income`
      : `${RDS_LABEL} is not added to income`
    : summary.cultIncome > 0
      ? summary.cultIncomeLabel
      : summary.settlement?.taxInvoiceDriveUrl
        ? "Tax invoice linked — settlement PDF not read yet"
        : summary.cultIncomeLabel;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Cult received"
          value={inr(summary.cultIncome)}
          subtitle={cultSubtitle}
        />
        <StatCard title="Owner PT share" value={inr(summary.ownerPtShare)} />
        <StatCard title="Gross income" value={inr(summary.grossIncome)} />
        <StatCard
          title="Net result"
          value={inr(summary.netResult)}
          subtitle="Cult received + owner PT − expenses − paid payroll"
          highlight={summary.netResult >= 0}
        />
      </div>

      {showCash ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            title={RDS_LABEL}
            value={summary.rds == null ? "—" : inr(summary.rds)}
            subtitle={RDS_HINT}
          />
          <StatCard
            title="Partner Share"
            value={summary.partnerShare == null ? "—" : inr(summary.partnerShare)}
            subtitle="Cult statement total — includes RDS"
          />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Manual expenses"
          value={inr(summary.manualExpenses)}
          subtitle={
            summary.supervisorSpends > 0
              ? `${inr(summary.supervisorSpends)} supervisor spends tracked (already in cash given)`
              : "Gym bills + cash given to supervisor"
          }
        />
        <StatCard
          title="Payroll (paid)"
          value={inr(summary.payrollPaid)}
          subtitle={
            summary.payrollPending > 0
              ? `${inr(summary.payrollPending)} pending — not included`
              : "Pending payroll is excluded"
          }
        />
        <StatCard title="Total costs" value={inr(summary.totalCosts)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Income mix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <MixRow label="Cult (received)" amount={summary.cultIncome} total={summary.grossIncome} />
            <MixRow label="Owner PT share" amount={summary.ownerPtShare} total={summary.grossIncome} />
            {summary.rds != null ? (
              <p className="text-xs text-muted-foreground">
                {RDS_LABEL} {inr(summary.rds)} is withheld by Cult and is not added to income.
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Trainer PT share ({inr(summary.trainerPtShare)}) is paid via payroll, not counted as
              owner income.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Expenses by category</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href={expensesPath}>Open expenses</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.expensesByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No manual expenses this month.</p>
            ) : (
              summary.expensesByCategory.map((row) => (
                <div key={row.category}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{row.label}</span>
                    <span className="font-medium">{inr(row.amount)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/80"
                      style={{ width: `${Math.round((row.amount / maxExpense) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
            <MixRow label="Payroll (paid)" amount={summary.payrollPaid} total={summary.totalCosts} />
            {summary.supervisorSpends > 0 ? (
              <p className="text-xs text-muted-foreground">
                Supervisor spends of {inr(summary.supervisorSpends)} this month are already included
                in cash given — not added again to Revenue.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">12-month trend</CardTitle>
        </CardHeader>
        <CardContent>
          {trend.every((p) => p.grossIncome === 0 && p.totalCosts === 0) ? (
            <p className="text-sm text-muted-foreground">
              Enter Cult figures and expenses to see month-over-month trend.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => inr(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="grossIncome" name="Gross income" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="totalCosts" name="Total costs" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="netResult" name="Net" stroke="hsl(142 40% 36%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 font-medium">Month</th>
                  <th className="py-2 font-medium">Cult received</th>
                  <th className="py-2 font-medium">{RDS_LABEL}</th>
                  <th className="py-2 font-medium">Owner PT</th>
                  <th className="py-2 font-medium">Expenses</th>
                  <th className="py-2 font-medium">Payroll</th>
                  <th className="py-2 font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {trend.map((row) => (
                  <tr key={row.label} className="border-b last:border-0">
                    <td className="py-2">{row.label}</td>
                    <td>
                      {row.cultIncomeSource === "none" && row.moneyReceived == null
                        ? "—"
                        : inr(row.cultIncome)}
                    </td>
                    <td className="text-muted-foreground">
                      {row.rds == null ? "—" : inr(row.rds)}
                    </td>
                    <td>{inr(row.ownerPtShare)}</td>
                    <td>{inr(row.manualExpenses)}</td>
                    <td>{inr(row.payrollPaid)}</td>
                    <td className="font-medium">{inr(row.netResult)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              Cult received is actual money in. {RDS_LABEL} is withheld by Cult and is not added to
              Net.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Owner PT by trainer</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href={reportsPath}>PT reports</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.ptByTrainer.length === 0 ? (
              <p className="text-sm text-muted-foreground">No PT collections this month.</p>
            ) : (
              summary.ptByTrainer.map((t) => (
                <div key={t.trainerId} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{t.trainerName}</p>
                    <p className="text-sm text-muted-foreground">
                      Trainer {inr(t.trainerShare)} · Package {inr(t.revenue)}
                    </p>
                  </div>
                  <p className="font-medium">{inr(t.ownerShare)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Payroll this month</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href={salariesPath}>Salaries</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.payrollRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payroll generated for this month.</p>
            ) : (
              summary.payrollRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{run.employeeName}</p>
                    <Badge variant={run.status === "PAID" ? "success" : "warning"}>{run.status}</Badge>
                  </div>
                  <p className="font-medium">{inr(run.netPay)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {showCash && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cult cash received</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <CashItem label="Cult received (in income)" value={summary.moneyReceived} />
            <CashItem
              label={`${RDS_LABEL} (not added to income)`}
              value={summary.rds}
            />
            <CashItem label="Partner Share" value={summary.partnerShare} />
            <CashItem label="Centre collections" value={summary.settlement?.centerCollections ?? null} />
            <CashItem label="Mid-month payment" value={summary.settlement?.midMonthPayment ?? null} />
            <CashItem label="Gross payable" value={summary.settlement?.grossPayable ?? null} />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild className="min-h-11">
          <Link href={expensesPath}>Open expenses</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href={salariesPath}>Open salaries</Link>
        </Button>
      </div>
    </div>
  );
}

function MixRow({ label, amount, total }: { label: string; amount: number; total: number }) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">
          {formatCurrency(amount)} {total > 0 ? `(${pct}%)` : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/80" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CashItem({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value == null ? "—" : formatCurrency(value)}</p>
    </div>
  );
}
