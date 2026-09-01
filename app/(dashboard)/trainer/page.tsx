import Link from "next/link";
import { requireTrainer } from "@/lib/session";
import { getTrainerHomeOverview } from "@/lib/services/home-overview";
import { formatTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiGrid } from "@/components/dashboard/kpi-card";
import {
  AmountRow,
  HomeAlerts,
  HomeHeader,
  HomeListCard,
  HomeSection,
  QuickLinks,
  TargetMeter,
} from "@/components/dashboard/home-sections";
import { CountDonutChart, EarningsTrendChart } from "@/components/dashboard/home-charts";

export const dynamic = "force-dynamic";

export default async function TrainerDashboardPage() {
  const user = await requireTrainer();
  if (!user.employeeId) {
    return <p className="text-muted-foreground">Trainer profile not found.</p>;
  }

  const home = await getTrainerHomeOverview(user.employeeId);
  if (!home) {
    return <p className="text-muted-foreground">Trainer profile not found.</p>;
  }

  return (
    <div className="space-y-8">
      <HomeHeader
        title="Home"
        subtitle={`Today's sessions, last month (${home.booksLabel}), and ${home.calendarLabel} so far.`}
        actions={
          <Button asChild size="lg" className="min-h-11">
            <Link href="/trainer/clients/new">+ Add Client</Link>
          </Button>
        }
      />
      <HomeAlerts alerts={home.alerts} />
      <KpiGrid items={home.kpis} />

      {home.target?.hasTarget && home.target.monthlyTarget ? (
        <TargetMeter
          label={`${home.target.splitPercent}% split · ${home.target.label}`}
          current={home.target.ptRevenue}
          target={home.target.monthlyTarget}
          met={home.target.targetMet}
        />
      ) : null}

      <HomeSection title="Today">
        <HomeListCard
          title="Today's sessions"
          href="/trainer/schedule"
          hrefLabel="Schedule"
          empty="No active clients with PT running. Expired clients appear under All Clients."
          isEmpty={home.todaySchedule.length === 0}
        >
          {home.todaySchedule.map((row) => (
            <Link
              key={row.clientId}
              href={`/trainer/clients/${row.clientId}`}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50"
            >
              <div>
                <p className="font-medium">{row.clientName}</p>
                <p className="text-sm text-muted-foreground">
                  {row.hasSlot && row.startAt
                    ? `${formatTime(row.startAt)}${row.endAt ? ` – ${formatTime(row.endAt)}` : ""}`
                    : "No time slot assigned today"}
                </p>
              </div>
              <Badge variant={row.hasSlot ? "default" : "secondary"}>
                {row.hasSlot ? "Scheduled" : "Unscheduled"}
              </Badge>
            </Link>
          ))}
        </HomeListCard>
      </HomeSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <EarningsTrendChart data={home.earningsTrend} />
        <CountDonutChart title="Client mix" data={home.clientMix} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <HomeListCard
          title="Renewals due"
          href="/trainer/clients"
          empty="No packs ending this week."
          isEmpty={home.expiringClients.length === 0}
        >
          {home.expiringClients.map((row) => (
            <AmountRow
              key={row.id}
              title={row.clientName}
              href={`/trainer/clients/${row.clientId}`}
              badge={{ label: "Renew", variant: "warning" }}
            />
          ))}
        </HomeListCard>

        <HomeListCard title="Latest payroll" href="/trainer/earnings" hrefLabel="Earnings">
          {home.payroll ? (
            <AmountRow
              title={home.payroll.status === "PAID" ? "Paid" : "Generated, unpaid"}
              subtitle={home.payroll.monthLabel}
              amount={home.payroll.netPay}
              badge={{
                label: home.payroll.status,
                variant: home.payroll.status === "PAID" ? "success" : "warning",
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No payroll has been generated yet.</p>
          )}
        </HomeListCard>
      </div>

      <QuickLinks
        links={[
          { href: "/trainer/clients/new", label: "Add client", primary: true },
          { href: "/trainer/schedule", label: "Schedule" },
          { href: "/trainer/clients", label: "All clients" },
          { href: "/trainer/earnings", label: "Earnings" },
        ]}
      />
    </div>
  );
}
