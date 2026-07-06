import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireTrainer } from "@/lib/session";
import { getTrainerDashboardStats } from "@/lib/services/pt-tracker";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import Link from "next/link";

export default async function TrainerDashboardPage() {
  const user = await requireTrainer();
  if (!user.employeeId) {
    return <p className="text-muted-foreground">Trainer profile not found.</p>;
  }

  const stats = await getTrainerDashboardStats(user.employeeId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Today</h1>
          <p className="text-muted-foreground">Your schedule and quick actions</p>
        </div>
        <Button asChild size="lg" className="min-h-11">
          <Link href="/trainer/clients/new">+ Add Client</Link>
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="My Clients" value={stats.clientCount.toString()} />
        <StatCard title="Today Sessions" value={stats.todaySessions.length.toString()} />
        <StatCard title="Open Slots" value={stats.openSlots.toString()} />
        <StatCard title="Earnings (MTD)" value={formatCurrency(stats.monthlyEarnings)} highlight />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Today&apos;s Sessions</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/trainer/schedule">Schedule</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.todaySessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions scheduled today.</p>
          ) : (
            stats.todaySessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">{session.client.name}</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(session.scheduledAt)}</p>
                </div>
                <Badge variant={session.status === "COMPLETED" ? "success" : "secondary"}>
                  {session.status}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {stats.expiringClients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Renewals Due</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.expiringClients.map((sub) => (
              <Link
                key={sub.id}
                href={`/trainer/clients/${sub.clientId}`}
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50"
              >
                <p className="font-medium">{sub.client.name}</p>
                <Badge variant="warning">Renew</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
