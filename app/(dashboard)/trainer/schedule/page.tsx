import { requireTrainer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SchedulePanel } from "@/components/salaries/salaries-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export default async function TrainerSchedulePage() {
  const user = await requireTrainer();
  if (!user.employeeId) return null;

  const [slots, sessions] = await Promise.all([
    prisma.trainerSlot.findMany({
      where: { trainerId: user.employeeId, startAt: { gte: new Date() } },
      orderBy: { startAt: "asc" },
      take: 20,
    }),
    prisma.session.findMany({
      where: {
        trainerId: user.employeeId,
        scheduledAt: { gte: new Date() },
      },
      include: { client: true },
      orderBy: { scheduledAt: "asc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-muted-foreground">Manage your day and available slots</p>
      </div>

      <SchedulePanel trainerId={user.employeeId} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Slots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No slots scheduled.</p>
          ) : (
            slots.map((slot) => (
              <div key={slot.id} className="flex justify-between rounded border p-3 text-sm">
                <span>
                  {formatDateTime(slot.startAt)} – {formatDateTime(slot.endAt)}
                  {slot.label && ` · ${slot.label}`}
                </span>
                <Badge variant={slot.isBlocked ? "destructive" : slot.clientId ? "default" : "success"}>
                  {slot.isBlocked ? "Blocked" : slot.clientId ? "Booked" : "Open"}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex justify-between rounded border p-3 text-sm">
              <span>
                {s.client.name} · {formatDateTime(s.scheduledAt)}
              </span>
              <Badge>{s.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
