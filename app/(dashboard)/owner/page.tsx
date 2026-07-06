import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireOwner } from "@/lib/session";
import { getOwnerDashboardStats, getTrainerOverview, syncSubscriptionStatuses } from "@/lib/services/pt-tracker";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AddTrainerForm,
  TrainerSplitEditor,
} from "@/components/owner/owner-dashboard-forms";
import { AddClientWithPTForm } from "@/components/clients/add-client-with-pt-form";

export default async function OwnerDashboardPage() {
  const user = await requireOwner();
  await syncSubscriptionStatuses(user.gymId);
  const [stats, trainers] = await Promise.all([
    getOwnerDashboardStats(user.gymId),
    getTrainerOverview(user.gymId),
  ]);

  const trainerOptions = trainers.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Owner Dashboard</h1>
        <p className="text-muted-foreground">
          Manage trainers, revenue splits, and client PT packages
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Trainers" value={stats.trainerCount.toString()} />
        <StatCard title="Active Clients" value={stats.activeClients.toString()} />
        <StatCard title="PT Revenue (MTD)" value={formatCurrency(stats.monthlyRevenue)} />
        <StatCard title="Your Share (MTD)" value={formatCurrency(stats.ownerShare)} highlight />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AddTrainerForm />
        <AddClientWithPTForm trainers={trainerOptions} showSuccessOnDashboard />
      </div>

      <TrainerSplitEditor trainers={trainers} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Trainers Overview</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/owner/trainers">Full management</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {trainers.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.clientCount} clients · {t.activeSplitPercent}% split
                    {t.hasTarget && t.monthlyTarget
                      ? ` · ${formatCurrency(t.monthlyRevenue)}/${formatCurrency(t.monthlyTarget)}`
                      : ""}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">{formatCurrency(t.monthlyRevenue)}</p>
                  <p className="text-muted-foreground">Owner: {formatCurrency(t.ownerShare)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Renewals Due (7 days)</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/owner/renewals">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.renewalsDue.length === 0 ? (
              <p className="text-sm text-muted-foreground">No renewals due this week.</p>
            ) : (
              stats.renewalsDue.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{r.clientName}</p>
                    <p className="text-sm text-muted-foreground">{r.trainerName}</p>
                  </div>
                  <Badge variant="warning">{formatDate(r.endDate)}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
