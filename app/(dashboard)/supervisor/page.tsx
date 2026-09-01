import { requireOwnerOrSupervisor } from "@/lib/session";
import { syncSubscriptionStatuses } from "@/lib/services/pt-tracker";
import { getSupervisorHomeOverview } from "@/lib/services/home-overview";
import { KpiGrid } from "@/components/dashboard/kpi-card";
import { AmountRow, HomeAlerts, HomeHeader, HomeListCard, QuickLinks } from "@/components/dashboard/home-sections";
import { DonutChart, SpendTrendChart, TrainerPtBarChart } from "@/components/dashboard/home-charts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function SupervisorDashboardPage() {
  const user = await requireOwnerOrSupervisor();
  await syncSubscriptionStatuses(user.gymId);
  const home = await getSupervisorHomeOverview(user.gymId);

  return (
    <div className="space-y-6">
      <HomeHeader
        title="Home"
        subtitle={`${home.monthLabel} operations — clients, petty cash, payroll, and renewals.`}
      />
      <HomeAlerts alerts={home.alerts} />
      <KpiGrid items={home.kpis} />

      <div className="grid gap-6 lg:grid-cols-2">
        <TrainerPtBarChart title="PT collected by trainer" data={home.ptByTrainer} />
        <DonutChart
          title="Spend this month"
          data={home.spendMix}
          empty="No supervisor spends this month."
        />
      </div>

      <SpendTrendChart data={home.spendTrend} />

      <div className="grid gap-6 lg:grid-cols-2">
        <HomeListCard
          title="Trainer load"
          href="/supervisor/trainers"
          hrefLabel="Trainers"
          empty="No trainers yet."
          isEmpty={home.ptByTrainer.length === 0}
        >
          {home.ptByTrainer.map((trainer) => (
            <AmountRow
              key={trainer.name}
              title={trainer.name}
              subtitle={`${trainer.clients} active clients`}
              amount={trainer.ptRevenue}
            />
          ))}
        </HomeListCard>

        <HomeListCard
          title="Renewals this week"
          href="/supervisor/renewals"
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
          title="Payroll this month"
          href="/supervisor/salaries"
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
          title="Recent spends"
          href="/supervisor/expenses"
          empty="No spends recorded yet."
          isEmpty={home.recentSpends.length === 0}
        >
          {home.recentSpends.map((row) => (
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
          { href: "/supervisor/expenses", label: "Log a spend", primary: true },
          { href: "/supervisor/clients", label: "Clients" },
          { href: "/supervisor/renewals", label: "Renewals" },
          { href: "/supervisor/salaries", label: "Salaries" },
          { href: "/supervisor/reports", label: "PT reports" },
          { href: "/supervisor/trainers", label: "Trainers" },
        ]}
      />
    </div>
  );
}
