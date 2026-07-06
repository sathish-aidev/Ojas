import { requireTrainer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { TrainerScheduleBoard } from "@/components/trainer/trainer-schedule-board";

export default async function TrainerSchedulePage() {
  const user = await requireTrainer();
  if (!user.employeeId) return null;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [activeClients, slots, sessions] = await Promise.all([
    prisma.client.findMany({
      where: {
        gymId: user.gymId,
        trainerId: user.employeeId,
        status: { in: ["ACTIVE", "TRIAL"] },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.trainerSlot.findMany({
      where: {
        trainerId: user.employeeId,
        startAt: { gte: startOfToday },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.session.findMany({
      where: {
        trainerId: user.employeeId,
        scheduledAt: { gte: startOfToday },
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-muted-foreground">
          Book clients by time slot — your day view sorted chronologically
        </p>
      </div>

      <TrainerScheduleBoard
        trainerId={user.employeeId}
        activeClients={activeClients}
        slots={slots.map((s) => ({
          id: s.id,
          startAt: s.startAt.toISOString(),
          endAt: s.endAt.toISOString(),
          isBlocked: s.isBlocked,
          label: s.label,
          clientId: s.clientId,
        }))}
        sessions={sessions.map((s) => ({
          id: s.id,
          scheduledAt: s.scheduledAt.toISOString(),
          status: s.status,
          client: s.client,
        }))}
      />
    </div>
  );
}
