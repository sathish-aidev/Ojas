import Link from "next/link";
import { requireOwnerOrSupervisor } from "@/lib/session";
import { getTrainerOverview } from "@/lib/services/pt-tracker";
import {
  defaultClosedViewMonth,
  formatMonthYear,
  isBeforeGymStart,
} from "@/lib/gym-calendar";
import { shiftMonth } from "@/lib/date-ymd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

export default async function SupervisorTrainersPage() {
  const user = await requireOwnerOrSupervisor();
  let viewMonth = defaultClosedViewMonth();
  let trainers = await getTrainerOverview(user.gymId, viewMonth);
  if (trainers.every((t) => t.monthlyRevenue === 0)) {
    const older = shiftMonth(viewMonth.month, viewMonth.year, -1);
    if (!isBeforeGymStart(older.month, older.year)) {
      const olderTrainers = await getTrainerOverview(user.gymId, older);
      if (olderTrainers.some((t) => t.monthlyRevenue > 0)) {
        viewMonth = older;
        trainers = olderTrainers;
      }
    }
  }
  const monthLabel = formatMonthYear(viewMonth.month, viewMonth.year);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Trainers</h1>
        <p className="text-muted-foreground">
          {monthLabel} PT collected — splits are set by the owner
        </p>
      </div>
      <div className="grid gap-3">
        {trainers.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No trainers yet.
            </CardContent>
          </Card>
        ) : (
          trainers.map((t) => (
            <Card key={t.id}>
              <CardHeader className="flex flex-col gap-2 space-y-0 pb-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-lg">{t.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {t.clientCount} active clients
                    {t.hasTarget && t.monthlyTarget
                      ? ` · Target ${formatCurrency(t.monthlyTarget)}`
                      : ""}
                  </p>
                </div>
                {t.hasTarget ? (
                  <Badge variant={t.targetMet ? "success" : "warning"}>
                    {t.targetMet ? "Target met" : "Below target"}
                  </Badge>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-muted-foreground">PT collected</p>
                    <p className="font-semibold">{formatCurrency(t.monthlyRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Trainer share</p>
                    <p className="font-medium">{formatCurrency(t.trainerShare)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Split</p>
                    <p className="font-medium">{t.activeSplitPercent}%</p>
                  </div>
                </div>
                <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
                  <Link
                    href={`/supervisor/reports?trainer=${t.id}&month=${viewMonth.month}&year=${viewMonth.year}`}
                  >
                    PT report
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
