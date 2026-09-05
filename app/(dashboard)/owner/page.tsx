import { requireOwner } from "@/lib/session";
import { syncSubscriptionStatuses } from "@/lib/services/pt-tracker";
import { getOwnerHomeOverview } from "@/lib/services/home-overview";
import { KpiGrid } from "@/components/dashboard/kpi-card";
import {
  AmountRow,
  HomeAlerts,
  HomeHeader,
  HomeListCard,
  HomeSection,
  MonthCompareTable,
  QuickLinks,
  YtdStrip,
} from "@/components/dashboard/home-sections";
import {
  CostTrendChart,
  DonutChart,
  ExpenseBarChart,
  OwnerPnlChart,
  TrainerPtBarChart,
} from "@/components/dashboard/home-charts";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function OwnerDashboardPage() {
  const user = await requireOwner();
  await syncSubscriptionStatuses(user.gymId);
  const home = await getOwnerHomeOverview(user.gymId);

  return (
    <div className="space-y-8">
      <HomeHeader title="Home" subtitle={home.subtitle} />
      <HomeAlerts alerts={home.alerts} />

      <HomeSection title={`Last closed books · ${home.booksLabel}`} subtitle={home.formula}>
        <KpiGrid items={home.closedKpis} />
        {home.compare ? (
          <MonthCompareTable
            booksLabel={home.compare.booksLabel}
            priorLabel={home.compare.priorLabel}
            rows={home.compare.rows}
          />
        ) : null}
        <YtdStrip ytd={home.ytd} />
        <OwnerPnlChart data={home.trend} subtitle={`Through ${home.booksLabel} closed books`} />
        <div className="grid gap-6 lg:grid-cols-2">
          <DonutChart
            title={`Income mix · ${home.booksLabel}`}
            data={home.incomeMix}
            empty={`No Cult or PT income in ${home.booksLabel}.`}
          />
          <ExpenseBarChart
            title={`Where money went · ${home.booksLabel}`}
            data={home.expenseMix}
            empty={`No bills or paid payroll in ${home.booksLabel}.`}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <TrainerPtBarChart
            title={`PT by trainer · ${home.ptMonthLabel}`}
            data={home.trainers}
            empty={`No PT collected in ${home.ptMonthLabel}.`}
          />
          <CostTrendChart data={home.trend} />
        </div>
        <HomeListCard
          title={`Payroll · ${home.payrollLabel}`}
          href="/owner/salaries"
          hrefLabel="Salaries"
          empty={`No payroll generated for ${home.payrollLabel}.`}
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
      </HomeSection>

      <HomeSection title="Right now" subtitle={`${home.calendarLabel} operations — not the monthly P&L`}>
        <KpiGrid items={home.liveKpis} />
        <div className="grid gap-6 lg:grid-cols-2">
          <HomeListCard
            title="Renewals this week"
            href="/owner/renewals"
            empty="No PT packs ending in the next 7 days."
            isEmpty={home.renewals.length === 0}
          >
            {home.renewals.map((row) => (
              <AmountRow
                key={row.id}
                href={`/owner/clients/${row.clientId}`}
                title={row.clientName}
                subtitle={row.trainerName}
                badge={{ label: row.endDateLabel, variant: "warning" }}
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
        <HomeListCard
          title={`Trainers · PT ${home.ptMonthLabel}`}
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
      </HomeSection>

      <QuickLinks
        links={[
          { href: home.booksHref, label: `${home.booksLabel} revenue`, primary: true },
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
