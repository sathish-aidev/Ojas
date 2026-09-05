import Link from "next/link";
import { cn } from "@/lib/utils";
import type { HomeKpi } from "@/lib/services/home-overview";

function deltaClass(pct: number, invert?: boolean) {
  const up = pct > 0.5;
  const down = pct < -0.5;
  if (invert) {
    if (up) return "text-red-600";
    if (down) return "text-emerald-600";
    return "text-muted-foreground";
  }
  if (up) return "text-emerald-600";
  if (down) return "text-red-600";
  return "text-muted-foreground";
}

function toneValueClass(tone?: HomeKpi["tone"]) {
  if (tone === "positive") return "text-emerald-700";
  if (tone === "negative") return "text-red-600";
  if (tone === "warning") return "text-amber-700";
  return "";
}

export function KpiCard({ title, value, subtitle, href, deltaPct, deltaInvert, highlight, tone }: HomeKpi) {
  const body = (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm sm:p-5",
        highlight && "border-primary/30 bg-primary/5",
        href && "transition-colors hover:border-primary/40 hover:bg-muted/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{title}</p>
        {deltaPct != null && Number.isFinite(deltaPct) ? (
          <p className={cn("text-xs font-medium", deltaClass(deltaPct, deltaInvert))}>
            {deltaPct > 0 ? "+" : ""}
            {Math.round(deltaPct)}%
          </p>
        ) : null}
      </div>
      <p className={cn("mt-1 text-xl font-bold tracking-tight sm:text-2xl", toneValueClass(tone))}>{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
    </div>
  );

  if (!href) return body;
  return (
    <Link href={href} className="block">
      {body}
    </Link>
  );
}

export function KpiGrid({ items }: { items: HomeKpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map((item) => (
        <KpiCard key={item.title} {...item} />
      ))}
    </div>
  );
}
