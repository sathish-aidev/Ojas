import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { CompareRow, HomeAlert, YtdTotals } from "@/lib/services/home-overview";

export function HomeHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function HomeSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function MonthCompareTable({
  booksLabel,
  priorLabel,
  rows,
}: {
  booksLabel: string;
  priorLabel: string;
  rows: CompareRow[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Closed month vs prior</CardTitle>
        <p className="text-sm text-muted-foreground">
          {booksLabel} compared with {priorLabel}
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Line</th>
              <th className="py-2 pr-3 text-right font-medium">{priorLabel}</th>
              <th className="py-2 pr-3 text-right font-medium">{booksLabel}</th>
              <th className="py-2 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const delta =
                row.prior == null || row.prior === 0
                  ? row.books === 0
                    ? 0
                    : null
                  : ((row.books - row.prior) / Math.abs(row.prior)) * 100;
              const up = delta != null && delta > 0.5;
              const down = delta != null && delta < -0.5;
              const invert = row.label === "Gym bills" || row.label === "Payroll paid";
              const deltaClass = invert
                ? up
                  ? "text-red-600"
                  : down
                    ? "text-emerald-600"
                    : "text-muted-foreground"
                : up
                  ? "text-emerald-600"
                  : down
                    ? "text-red-600"
                    : "text-muted-foreground";
              return (
                <tr key={row.label} className="border-b last:border-0">
                  <td className="py-2.5 pr-3 font-medium">{row.label}</td>
                  <td className="py-2.5 pr-3 text-right text-muted-foreground">
                    {row.prior == null ? "—" : formatCurrency(row.prior)}
                  </td>
                  <td className="py-2.5 pr-3 text-right">{formatCurrency(row.books)}</td>
                  <td className={`py-2.5 text-right ${deltaClass}`}>
                    {delta == null ? "—" : `${delta > 0 ? "+" : ""}${Math.round(delta)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function YtdStrip({ ytd }: { ytd: YtdTotals }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Year to date</CardTitle>
        <p className="text-sm text-muted-foreground">
          {ytd.year} through {ytd.throughLabel} closed books
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-4">
        <div>
          <p className="text-sm text-muted-foreground">Gross income</p>
          <p className="text-xl font-semibold">{formatCurrency(ytd.grossIncome)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total PT</p>
          <p className="text-xl font-semibold">{formatCurrency(ytd.ptRevenue)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Costs</p>
          <p className="text-xl font-semibold">{formatCurrency(ytd.totalCosts)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Net</p>
          <p className={`text-xl font-semibold ${ytd.netResult >= 0 ? "text-emerald-700" : "text-red-600"}`}>
            {formatCurrency(ytd.netResult)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function HomeAlerts({ alerts }: { alerts: HomeAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="grid gap-2">
      {alerts.map((alert) => (
        <Link
          key={`${alert.href}-${alert.text}`}
          href={alert.href}
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors hover:bg-muted/50 ${
            alert.tone === "warning"
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : "border-sky-200 bg-sky-50 text-sky-950"
          }`}
        >
          {alert.tone === "warning" ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{alert.text}</span>
        </Link>
      ))}
    </div>
  );
}

export function QuickLinks({
  links,
}: {
  links: Array<{ href: string; label: string; primary?: boolean }>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Button key={link.href} asChild variant={link.primary ? "default" : "outline"} className="min-h-11">
          <Link href={link.href}>{link.label}</Link>
        </Button>
      ))}
    </div>
  );
}

export function HomeListCard({
  title,
  href,
  hrefLabel,
  empty,
  isEmpty,
  children,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  empty?: string;
  isEmpty?: boolean;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">{title}</CardTitle>
        {href ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href}>{hrefLabel ?? "View all"}</Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {isEmpty && empty ? <p className="text-sm text-muted-foreground">{empty}</p> : children}
      </CardContent>
    </Card>
  );
}

export function AmountRow({
  title,
  subtitle,
  amount,
  badge,
  href,
}: {
  title: string;
  subtitle?: string;
  amount?: string | number;
  badge?: { label: string; variant?: "default" | "secondary" | "success" | "warning" };
  href?: string;
}) {
  const inner = (
    <>
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-right">
        {badge ? <Badge variant={badge.variant ?? "secondary"}>{badge.label}</Badge> : null}
        {amount != null ? (
          <p className="font-medium">{typeof amount === "number" ? formatCurrency(amount) : amount}</p>
        ) : null}
      </div>
    </>
  );

  const className = "flex items-center justify-between gap-3 rounded-lg border p-3";
  if (href) {
    return (
      <Link href={href} className={`${className} hover:bg-muted/50`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

export function TargetMeter({
  label,
  current,
  target,
  met,
}: {
  label: string;
  current: number;
  target: number;
  met: boolean;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-end justify-between gap-2">
          <p className="text-2xl font-bold tracking-tight">{formatCurrency(current)}</p>
          <p className="text-sm text-muted-foreground">of {formatCurrency(target)}</p>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${met ? "bg-emerald-600" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">{met ? "Target met" : `${pct}% of monthly target`}</p>
      </CardContent>
    </Card>
  );
}
