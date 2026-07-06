import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireOwnerOrSupervisor } from "@/lib/session";
import { getOwnerDashboardStats, getTrainerOverview, syncSubscriptionStatuses } from "@/lib/services/pt-tracker";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function SupervisorDashboardPage() {
  const user = await requireOwnerOrSupervisor();
  await syncSubscriptionStatuses(user.gymId);
  const [stats, trainers] = await Promise.all([
    getOwnerDashboardStats(user.gymId),
    getTrainerOverview(user.gymId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Supervisor Dashboard</h1>
        <p className="text-muted-foreground">Operations and renewals overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Trainers" value={stats.trainerCount.toString()} />
        <StatCard title="Active Clients" value={stats.activeClients.toString()} />
        <StatCard title="PT Revenue (MTD)" value={formatCurrency(stats.monthlyRevenue)} />
        <StatCard title="Renewals (7d)" value={stats.renewalsDue.length.toString()} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Trainer Overview</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/supervisor/trainers">View trainers</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {trainers.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-sm text-muted-foreground">{t.clientCount} active clients</p>
              </div>
              <p className="font-medium">{formatCurrency(t.monthlyRevenue)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Renewals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.renewalsDue.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{r.clientName}</p>
                <p className="text-sm text-muted-foreground">{r.trainerName}</p>
              </div>
              <Badge variant="warning">{formatDate(r.endDate)}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
