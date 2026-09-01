import { requireOwner } from "@/lib/session";
import { syncSubscriptionStatuses } from "@/lib/services/pt-tracker";
import { getOwnerHomeOverview } from "@/lib/services/home-overview";
import { KpiGrid } from "@/components/dashboard/kpi-card";
import { AmountRow, HomeAlerts, HomeHeader, HomeListCard, QuickLinks } from "@/components/dashboard/home-sections";
import { CostTrendChart, DonutChart, OwnerPnlChart, TrainerPtBarChart } from "@/components/dashboard/home-charts";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function OwnerDashboardPage() {
  const user = await requireOwner();
  await syncSubscriptionStatuses(user.gymId);
  const home = await getOwnerHomeOverview(user.gymId);

  return (
    <div className="space-y-6">
      <HomeHeader
        title="Home"
        subtitle={`${home.monthLabel} snapshot — ${home.formula}.`}
      />
      <HomeAlerts alerts={home.alerts} />
      <KpiGrid items={home.kpis} />

      <OwnerPnlChart data={home.trend} />

      <div className="grid gap-6 lg:grid-cols-2">
        <DonutChart title="Income mix this month" data={home.incomeMix} empty="No Cult or PT income this month." />
        <DonutChart title="Where money went" data={home.expenseMix} empty="No bills or paid payroll this month." />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TrainerPtBarChart title="PT by trainer" data={home.trainers} />
        <CostTrendChart data={home.trend} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <HomeListCard
          title="Payroll this month"
          href="/owner/salaries"
          hrefLabel="Salaries"
          empty="No payroll generated for this month."
          isEmpty={home.payroll.length === 0}
        >
          {home.payroll.map((run) => (
            <AmountRow
              key={run.id}
              title={run.name}
              amount={run.netPay}
              badge={{
                label: run.status,
                variant: run.status === "PAID" ? "success" : "warning",
              }}
            />
          ))}
        </HomeListCard>

        <HomeListCard
          title="Renewals this week"
          href="/owner/renewals"
          empty="No PT packs ending in the next 7 days."
          isEmpty={home.renewals.length === 0}
        >
          {home.renewals.map((row) => (
            <AmountRow
              key={row.id}
              title={row.clientName}
              subtitle={row.trainerName}
              badge={{ label: row.endDateLabel, variant: "warning" }}
            />
          ))}
        </HomeListCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <HomeListCard
          title="Trainer snapshot"
          href="/owner/trainers"
          hrefLabel="Manage team"
          empty="No trainers yet."
          isEmpty={home.trainers.length === 0}
        >
          {home.trainers.map((trainer) => (
            <AmountRow
              key={trainer.name}
              title={trainer.name}
              subtitle={
                trainer.hasTarget && trainer.target
                  ? `${trainer.clients} clients · Owner ${formatCurrency(trainer.ownerShare)} · ${formatCurrency(trainer.ptRevenue)} / ${formatCurrency(trainer.target)}`
                  : `${trainer.clients} clients · Owner ${formatCurrency(trainer.ownerShare)}`
              }
              amount={trainer.ptRevenue}
            />
          ))}
        </HomeListCard>

        <HomeListCard
          title="Recent gym bills"
          href="/owner/expenses"
          empty="No gym bills recorded yet."
          isEmpty={home.recentExpenses.length === 0}
        >
          {home.recentExpenses.map((row) => (
            <AmountRow
              key={row.id}
              title={row.description || row.category}
              subtitle={`${row.dateLabel} · ${row.category}`}
              amount={row.amount}
            />
          ))}
        </HomeListCard>
      </div>

      <QuickLinks
        links={[
          { href: "/owner/revenue", label: "Revenue", primary: true },
          { href: "/owner/expenses", label: "Expenses" },
          { href: "/owner/salaries", label: "Salaries" },
          { href: "/owner/reports", label: "PT reports" },
          { href: "/owner/clients", label: "Clients" },
          { href: "/owner/renewals", label: "Renewals" },
          { href: "/owner/trainers", label: "Team" },
        ]}
      />
    </div>
  );
}
