"use client";

import { useMemo, useState } from "react";
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
import type { ExpenseDashboard, SerializedExpense } from "@/lib/services/expenses";
import { ExpensesPanel } from "@/components/revenue/expenses-panel";
import type { ExpenseCategory, PaymentMode } from "@prisma/client";

function inr(value: number) {
  return formatCurrency(value);
}

export function ExpensesWorkspace({
  monthLabel,
  dashboard,
  monthExpenses,
  yearExpenses,
  sheetUrl,
  sheetError,
}: {
  monthLabel: string;
  dashboard: ExpenseDashboard;
  monthExpenses: SerializedExpense[];
  yearExpenses: SerializedExpense[];
  sheetUrl?: string | null;
  sheetError?: string | null;
}) {
  const [range, setRange] = useState<"month" | "year">("month");
  const [category, setCategory] = useState<"all" | ExpenseCategory>("all");
  const [mode, setMode] = useState<"all" | PaymentMode | "UNSET">("all");

  const source = range === "month" ? monthExpenses : yearExpenses;
  const filtered = useMemo(() => {
    return source.filter((row) => {
      if (category !== "all" && row.category !== category) return false;
      if (mode === "UNSET" && row.paymentMode != null) return false;
      if (mode !== "all" && mode !== "UNSET" && row.paymentMode !== mode) return false;
      return true;
    });
  }, [source, category, mode]);

  const maxCategory = Math.max(1, ...dashboard.byCategory.map((c) => c.amount));
  const mom =
    dashboard.momPercent == null
      ? "No prior month"
      : `${dashboard.momPercent >= 0 ? "+" : ""}${dashboard.momPercent.toFixed(0)}% vs last month`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="This month" value={inr(dashboard.total)} subtitle={monthLabel} />
        <StatCard title="vs last month" value={inr(dashboard.lastMonthTotal)} subtitle={mom} />
        <StatCard
          title="Top category"
          value={dashboard.topCategory ? inr(dashboard.topCategory.amount) : "—"}
          subtitle={dashboard.topCategory?.label ?? "No expenses this month"}
        />
        <StatCard
          title="Year to date"
          value={inr(dashboard.ytdTotal)}
          subtitle={`${dashboard.entryCount} entries this month`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses this month.</p>
            ) : (
              dashboard.byCategory.map((row) => (
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
            <CardTitle className="text-lg">12-month trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboard.trend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <Tooltip formatter={(value: number) => inr(value)} />
                  <Line type="monotone" dataKey="total" name="Expenses" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {dashboard.byPaymentMode.length > 0 && (
              <div className="mt-4 space-y-1 text-sm">
                <p className="font-medium">Payment mode</p>
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
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">View</span>
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={range}
            onChange={(e) => setRange(e.target.value as "month" | "year")}
          >
            <option value="month">This month</option>
            <option value="year">This year</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Category</span>
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value as "all" | ExpenseCategory)}
          >
            <option value="all">All</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Payment</span>
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
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
        <p className="text-sm text-muted-foreground">
          {filtered.length} row{filtered.length === 1 ? "" : "s"} · {inr(filtered.reduce((s, r) => s + r.amount, 0))}
        </p>
      </div>

      <ExpensesPanel
        expenses={filtered}
        monthLabel={range === "month" ? monthLabel : `${dashboard.year} (filtered)`}
        sheetUrl={sheetUrl}
        sheetError={sheetError}
      />
    </div>
  );
}
