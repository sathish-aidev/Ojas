"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatCurrency, PAYMENT_MODE_LABELS } from "@/lib/utils";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/revenue-constants";
import { SUPERVISOR_SPEND_CATEGORIES } from "@/lib/services/expense-kinds";
import type { ExpenseDashboard, SerializedExpense } from "@/lib/services/expenses";
import { getMonthName } from "@/lib/permissions";
import { monthsFromGymStartThrough } from "@/lib/gym-calendar";
import { ExpensesPanel } from "@/components/revenue/expenses-panel";
import type { ExpenseCategory, ExpenseKind, PaymentMode, UserRole } from "@prisma/client";

function inr(value: number) {
  return formatCurrency(value);
}

type LedgerView = "pnl" | "spend" | "all";

function matchesLedger(row: SerializedExpense, ledger: LedgerView) {
  if (ledger === "all") return true;
  if (ledger === "spend") return row.kind === "SUPERVISOR_SPEND";
  return row.kind === "OWNER_BILL" || row.kind === "SUPERVISOR_ADVANCE";
}

export function ExpensesWorkspace({
  monthLabel,
  month,
  year,
  dashboard,
  monthExpenses,
  yearExpenses,
  sheetUrl,
  supervisorSheetUrl,
  sheetError,
  role,
}: {
  monthLabel: string;
  month: number;
  year: number;
  dashboard: ExpenseDashboard;
  monthExpenses: SerializedExpense[];
  yearExpenses: SerializedExpense[];
  sheetUrl?: string | null;
  supervisorSheetUrl?: string | null;
  sheetError?: string | null;
  role: UserRole;
}) {
  const isOwner = role === "OWNER";
  const router = useRouter();
  const pathname = usePathname();
  const [range, setRange] = useState<"month" | "year">("month");
  const [ledger, setLedger] = useState<LedgerView>(isOwner ? "pnl" : "all");
  const [category, setCategory] = useState<"all" | ExpenseCategory>("all");
  const [mode, setMode] = useState<"all" | PaymentMode | "UNSET">("all");
  const [kind, setKind] = useState<"all" | ExpenseKind>("all");

  const viewMonths = monthsFromGymStartThrough(12, year).filter((item) => item.year === year);

  function selectMonth(nextMonth: number) {
    setRange("month");
    router.push(`${pathname}?month=${nextMonth}&year=${year}`);
  }

  const source = range === "month" ? monthExpenses : yearExpenses;
  const filterCategories = isOwner ? EXPENSE_CATEGORIES : SUPERVISOR_SPEND_CATEGORIES;
  const filtered = useMemo(() => {
    return source.filter((row) => {
      if (!matchesLedger(row, ledger)) return false;
      if (kind !== "all" && row.kind !== kind) return false;
      if (category !== "all" && row.category !== category) return false;
      if (mode === "UNSET" && row.paymentMode != null) return false;
      if (mode !== "all" && mode !== "UNSET" && row.paymentMode !== mode) return false;
      return true;
    });
  }, [source, ledger, kind, category, mode]);

  const categoryRows = isOwner ? dashboard.byCategory : dashboard.spendByCategory;
  const maxCategory = Math.max(1, ...categoryRows.map((c) => c.amount));
  const mom =
    dashboard.momPercent == null
      ? "No prior month"
      : `${dashboard.momPercent >= 0 ? "+" : ""}${dashboard.momPercent.toFixed(0)}% vs last month`;
  const remainingLow = dashboard.pettyRemaining < 2000;
  const remainingOverdrawn = dashboard.pettyRemaining < 0;

  return (
    <div className="space-y-6">
      {isOwner ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Gym cost this month" value={inr(dashboard.total)} subtitle={`${monthLabel} · in Revenue`} />
          <StatCard title="vs last month" value={inr(dashboard.lastMonthTotal)} subtitle={mom} />
          <StatCard
            title="Cash with supervisor"
            value={inr(dashboard.pettyRemaining)}
            subtitle={`Given ${inr(dashboard.pettyIssuedMonth)} this month · spent ${inr(dashboard.pettySpentMonth)}`}
            highlight={remainingOverdrawn || remainingLow}
          />
          <StatCard
            title="Year to date (Revenue)"
            value={inr(dashboard.ytdTotal)}
            subtitle={`${dashboard.entryCount} gym-cost entries this month`}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Cash remaining"
            value={inr(dashboard.pettyRemaining)}
            subtitle={
              remainingOverdrawn
                ? "Overdrawn — ask owner for a top-up"
                : remainingLow
                  ? "Running low — ask owner for a top-up"
                  : "From cash the owner has given you"
            }
            highlight={remainingOverdrawn || remainingLow}
          />
          <StatCard title="Given this month" value={inr(dashboard.pettyIssuedMonth)} subtitle={monthLabel} />
          <StatCard title="Spent this month" value={inr(dashboard.pettySpentMonth)} subtitle="Not added to Revenue" />
          <StatCard
            title="Spent (all time)"
            value={inr(dashboard.pettySpentAll)}
            subtitle={`From ${inr(dashboard.pettyIssuedAll)} given in total`}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{isOwner ? "By category (Revenue)" : "Spends by category"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {categoryRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rows this month.</p>
            ) : (
              categoryRows.map((row) => (
                <div key={row.category}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{row.label}</span>
                    <span className="font-medium">{inr(row.amount)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/80"
                      style={{ width: `${Math.round((row.amount / maxCategory) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{isOwner ? "12-month gym cost" : "12-month spends"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboard.trend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <Tooltip formatter={(value: number) => inr(value)} />
                  <Line
                    type="monotone"
                    dataKey={isOwner ? "pnlTotal" : "spendTotal"}
                    name={isOwner ? "Gym cost" : "Spends"}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {dashboard.byPaymentMode.length > 0 && isOwner && (
              <div className="mt-4 space-y-1 text-sm">
                <p className="font-medium">Payment mode (Revenue)</p>
                {dashboard.byPaymentMode.map((row) => (
                  <div key={row.mode} className="flex justify-between text-muted-foreground">
                    <span>{row.label}</span>
                    <span>{inr(row.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {isOwner ? (
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Ledger</span>
            <select
              className="flex h-11 w-full min-w-[10rem] rounded-md border border-input bg-background px-3 text-sm sm:w-auto"
              value={ledger}
              onChange={(e) => setLedger(e.target.value as LedgerView)}
            >
              <option value="pnl">Gym costs (in Revenue)</option>
              <option value="spend">Supervisor spends</option>
              <option value="all">All</option>
            </select>
          </label>
        ) : null}
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">View</span>
          <select
            className="flex h-11 w-full min-w-[10rem] rounded-md border border-input bg-background px-3 text-sm sm:w-auto"
            value={range === "year" ? "year" : `m:${month}`}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "year") {
                setRange("year");
                return;
              }
              const nextMonth = Number(value.replace("m:", ""));
              if (Number.isFinite(nextMonth)) selectMonth(nextMonth);
            }}
          >
            {viewMonths.map((item) => (
              <option key={item.month} value={`m:${item.month}`}>
                {getMonthName(item.month)} {item.year}
              </option>
            ))}
            <option value="year">This year</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Category</span>
          <select
            className="flex h-11 w-full min-w-[10rem] rounded-md border border-input bg-background px-3 text-sm sm:w-auto"
            value={category}
            onChange={(e) => setCategory(e.target.value as "all" | ExpenseCategory)}
          >
            <option value="all">All</option>
            {filterCategories.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Payment</span>
          <select
            className="flex h-11 w-full min-w-[10rem] rounded-md border border-input bg-background px-3 text-sm sm:w-auto"
            value={mode}
            onChange={(e) => setMode(e.target.value as "all" | PaymentMode | "UNSET")}
          >
            <option value="all">All</option>
            <option value="UNSET">Not set</option>
            {Object.entries(PAYMENT_MODE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {isOwner ? (
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Type</span>
            <select
              className="flex h-11 w-full min-w-[10rem] rounded-md border border-input bg-background px-3 text-sm sm:w-auto"
              value={kind}
              onChange={(e) => setKind(e.target.value as "all" | ExpenseKind)}
            >
              <option value="all">All types</option>
              <option value="OWNER_BILL">Owner bill</option>
              <option value="SUPERVISOR_ADVANCE">Cash given</option>
              <option value="SUPERVISOR_SPEND">Supervisor spend</option>
            </select>
          </label>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {filtered.length} row{filtered.length === 1 ? "" : "s"} · {inr(filtered.reduce((s, r) => s + r.amount, 0))}
        </p>
      </div>

      <ExpensesPanel
        expenses={filtered}
        monthLabel={range === "month" ? monthLabel : `${dashboard.year} (filtered)`}
        sheetUrl={sheetUrl}
        supervisorSheetUrl={supervisorSheetUrl}
        sheetError={sheetError}
        role={role}
      />
    </div>
  );
}
