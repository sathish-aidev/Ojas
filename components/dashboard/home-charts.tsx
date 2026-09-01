"use client";

import type { ReactNode } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { NamedAmount, TrendPoint } from "@/lib/services/home-overview";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(199 89% 48%)",
  "hsl(24 95% 53%)",
];

function compactInr(value: number) {
  const abs = Math.abs(value);
  if (abs >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `₹${Math.round(value / 1000)}k`;
  return formatCurrency(value);
}

function ChartCard({
  title,
  subtitle,
  children,
  height = 280,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  height?: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>
      <CardContent>
        <div style={{ height }}>{children}</div>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function OwnerPnlChart({ data, subtitle }: { data: TrendPoint[]; subtitle?: string }) {
  const hasData = data.some((row) => row.grossIncome !== 0 || row.totalCosts !== 0 || row.ptRevenue !== 0);
  return (
    <ChartCard title="Income and net" subtitle={subtitle ?? "Cult after TDS + PT vs net result"} height={320}>
      {!hasData ? (
        <EmptyChart message="No revenue figures yet. Enter Cult settlement and PT to see the trend." />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={compactInr} width={56} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Bar dataKey="cultIncome" name="Cult after TDS" stackId="income" fill="hsl(var(--chart-1))" radius={[0, 0, 0, 0]} />
            <Bar dataKey="ptRevenue" name="Total PT" stackId="income" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="netResult" name="Net" stroke="hsl(var(--chart-3))" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function CostTrendChart({ data }: { data: TrendPoint[] }) {
  const hasData = data.some((row) => row.expenses !== 0 || row.payrollPaid !== 0);
  return (
    <ChartCard title="Costs" subtitle="Gym bills and paid payroll">
      {!hasData ? (
        <EmptyChart message="No expenses or payroll recorded yet." />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={compactInr} width={56} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Area
              type="monotone"
              dataKey="expenses"
              name="Bills"
              stroke="hsl(var(--chart-5))"
              fill="hsl(var(--chart-5))"
              fillOpacity={0.18}
            />
            <Area
              type="monotone"
              dataKey="payrollPaid"
              name="Payroll"
              stroke="hsl(var(--chart-4))"
              fill="hsl(var(--chart-4))"
              fillOpacity={0.18}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function DonutChart({
  title,
  data,
  empty = "Nothing to show this month.",
}: {
  title: string;
  data: NamedAmount[];
  empty?: string;
}) {
  const total = data.reduce((sum, row) => sum + row.value, 0);
  return (
    <ChartCard title={title}>
      {total <= 0 ? (
        <EmptyChart message={empty} />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={2}
            >
              {data.map((row, index) => (
                <Cell key={row.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function CountDonutChart({
  title,
  data,
  empty = "No clients yet.",
}: {
  title: string;
  data: NamedAmount[];
  empty?: string;
}) {
  const total = data.reduce((sum, row) => sum + row.value, 0);
  return (
    <ChartCard title={title}>
      {total <= 0 ? (
        <EmptyChart message={empty} />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={2}>
              {data.map((row, index) => (
                <Cell key={row.name} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function ExpenseBarChart({
  title,
  subtitle,
  data,
  empty = "No bills in the closed month.",
}: {
  title: string;
  subtitle?: string;
  data: NamedAmount[];
  empty?: string;
}) {
  const hasData = data.some((row) => row.value > 0);
  return (
    <ChartCard title={title} subtitle={subtitle}>
      {!hasData ? (
        <EmptyChart message={empty} />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis type="number" tickFormatter={compactInr} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Bar dataKey="value" name="Amount" fill="hsl(var(--chart-5))" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function TrainerPtBarChart({
  title,
  data,
  empty = "No PT collected this month.",
}: {
  title: string;
  data: Array<{ name: string; ptRevenue: number; clients?: number }>;
  empty?: string;
}) {
  const hasData = data.some((row) => row.ptRevenue > 0);
  return (
    <ChartCard title={title}>
      {!hasData ? (
        <EmptyChart message={empty} />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis type="number" tickFormatter={compactInr} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(label) => {
                const row = data.find((item) => item.name === label);
                return row?.clients != null ? `${label} · ${row.clients} clients` : String(label);
              }}
            />
            <Bar dataKey="ptRevenue" name="PT collected" fill="hsl(var(--chart-1))" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function EarningsTrendChart({
  data,
}: {
  data: Array<{ label: string; earnings: number; ptRevenue: number }>;
}) {
  const hasData = data.some((row) => row.earnings > 0 || row.ptRevenue > 0);
  return (
    <ChartCard title="Earnings trend" subtitle="Your share vs PT collected">
      {!hasData ? (
        <EmptyChart message="No collections in recent months." />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={compactInr} width={56} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Legend />
            <Bar dataKey="ptRevenue" name="PT collected" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="earnings" name="Your share" stroke="hsl(var(--chart-2))" strokeWidth={2.5} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function SpendTrendChart({ data }: { data: Array<{ label: string; spent: number }> }) {
  const hasData = data.some((row) => row.spent > 0);
  return (
    <ChartCard title="Spend trend" subtitle="Supervisor spends by month">
      {!hasData ? (
        <EmptyChart message="No supervisor spends recorded yet." />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={compactInr} width={56} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Area
              type="monotone"
              dataKey="spent"
              name="Spent"
              stroke="hsl(var(--chart-3))"
              fill="hsl(var(--chart-3))"
              fillOpacity={0.2}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
