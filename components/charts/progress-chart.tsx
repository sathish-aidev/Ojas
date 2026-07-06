"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatDate } from "@/lib/utils";

type ChartPoint = { value: number; recordedAt: string };

export function ProgressChart({
  data,
  title,
  targetValue,
  unit = "",
}: {
  data: ChartPoint[];
  title: string;
  targetValue?: number;
  unit?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">
        No {title.toLowerCase()} data yet
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: formatDate(d.recordedAt),
  }));

  return (
    <div className="rounded-lg border p-4">
      <p className="mb-3 text-sm font-medium">{title}</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} unit={unit ? ` ${unit}` : ""} />
          <Tooltip formatter={(value: number) => [`${value}${unit ? ` ${unit}` : ""}`, title]} />
          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot />
          {targetValue !== undefined && (
            <ReferenceLine y={targetValue} stroke="hsl(var(--chart-2))" strokeDasharray="4 4" label="Goal" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
