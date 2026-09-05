import Link from "next/link";
import { requireOwnerOrSupervisor } from "@/lib/session";
import { syncSubscriptionStatuses } from "@/lib/services/pt-tracker";
import { getSupervisorHomeOverview } from "@/lib/services/home-overview";
import { KpiGrid } from "@/components/dashboard/kpi-card";
import { Button } from "@/components/ui/button";
import {
  AmountRow,
  HomeAlerts,
  HomeHeader,
  HomeListCard,
  HomeSection,
  MonthCompareTable,
  QuickLinks,
} from "@/components/dashboard/home-sections";
import {
  DonutChart,
  ExpenseBarChart,
  SpendTrendChart,
  TrainerPtBarChart,
} from "@/components/dashboard/home-charts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function SupervisorDashboardPage() {
  const user = await requireOwnerOrSupervisor();
  await syncSubscriptionStatuses(user.gymId);
  const home = await getSupervisorHomeOverview(user.gymId);

  return (
    <div className="space-y-8">
      <HomeHeader
        title="Home"
        subtitle={home.subtitle}
        actions={
          <>
            <Button asChild className="min-h-11 w-full sm:w-auto">
              <Link href="/supervisor/expenses">Log spend</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
              <Link href="/supervisor/clients/new">Add client</Link>
            </Button>
          </>
        }
      />
      <HomeAlerts alerts={home.alerts} />

      <HomeSection title="Right now" subtitle={`${home.calendarLabel} — clients, cash, and renewals`}>
        <KpiGrid items={home.liveKpis} />
        <div className="grid gap-6 lg:grid-cols-2">
          <HomeListCard
            title="Renewals this week"
            href="/supervisor/renewals"
            empty="No PT packs ending in the next 7 days."
            isEmpty={home.renewals.length === 0}
          >
            {home.renewals.map((row) => (
              <AmountRow
                key={row.id}
                href={`/supervisor/clients/${row.clientId}`}
                title={row.clientName}
                subtitle={row.trainerName}
                badge={{ label: row.endDateLabel, variant: "warning" }}
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
                href="/supervisor/expenses"
                title={row.description || row.category}
                subtitle={`${row.dateLabel} · ${row.category}`}
                amount={row.amount}
              />
            ))}
          </HomeListCard>
        </div>
      </HomeSection>

      <HomeSection
        title={`Last closed books · ${home.booksLabel}`}
        subtitle={`${home.ptMonthLabel} PT and ${home.spendMonthLabel} spends — not the in-progress month`}
      >
        <KpiGrid items={home.closedKpis} />
        {home.compare ? (
          <MonthCompareTable
            booksLabel={home.compare.booksLabel}
            priorLabel={home.compare.priorLabel}
            rows={home.compare.rows}
          />
        ) : null}
        <div className="grid gap-6 lg:grid-cols-2">
          <TrainerPtBarChart
            title={`PT collected · ${home.ptMonthLabel}`}
            data={home.ptByTrainer}
            empty={`No PT collected in ${home.ptMonthLabel}.`}
          />
          <ExpenseBarChart
            title={`Where cash went · ${home.spendMonthLabel}`}
            data={home.spendMix}
            empty={`No supervisor spends in ${home.spendMonthLabel}.`}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <DonutChart
            title={`Spend mix · ${home.spendMonthLabel}`}
            data={home.spendMix}
            empty={`No supervisor spends in ${home.spendMonthLabel}.`}
          />
          <SpendTrendChart data={home.spendTrend} />
        </div>
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
            title={`Payroll · ${home.payrollLabel}`}
            href={home.salariesHref}
            hrefLabel="Salaries"
            empty={`No payroll generated for ${home.payrollLabel}.`}
            isEmpty={home.payroll.length === 0}
          >
            {home.payroll.map((run) => (
              <AmountRow
                key={run.id}
                href={home.salariesHref}
                title={run.name}
                amount={run.netPay}
                badge={{
                  label: run.status,
                  variant: run.status === "PAID" ? "success" : "warning",
                }}
              />
            ))}
          </HomeListCard>
        </div>
      </HomeSection>

      <QuickLinks
        links={[
          { href: "/supervisor/expenses", label: "Log a spend", primary: true },
          { href: "/supervisor/clients/new", label: "Add client" },
          { href: "/supervisor/clients", label: "Clients" },
          { href: "/supervisor/renewals", label: "Renewals" },
          { href: home.salariesHref, label: "Salaries" },
          { href: home.reportsHref, label: "PT reports" },
          { href: "/supervisor/trainers", label: "Trainers" },
        ]}
      />
    </div>
  );
}
