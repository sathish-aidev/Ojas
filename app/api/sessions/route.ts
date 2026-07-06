import { prisma } from "@/lib/prisma";
import { getApiUser, unauthorized, forbidden, badRequest, ok } from "@/lib/api-utils";
import { canManageClients } from "@/lib/permissions";
import { sessionSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const trainerId =
    user.role === "TRAINER" ? user.employeeId : searchParams.get("trainerId");

  if (!trainerId) return badRequest("trainerId required");

  const dayStart = date ? new Date(date) : new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  const sessions = await prisma.session.findMany({
    where: {
      trainerId,
      scheduledAt: { gte: dayStart, lte: dayEnd },
      client: { gymId: user.gymId },
    },
    include: { client: true },
    orderBy: { scheduledAt: "asc" },
  });

  return ok(sessions);
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canManageClients(user.role)) return forbidden();

  const body = await request.json();
  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");

  const client = await prisma.client.findFirst({
    where: { id: parsed.data.clientId, gymId: user.gymId },
  });
  if (!client) return badRequest("Client not found");
  if (user.role === "TRAINER" && client.trainerId !== user.employeeId) return forbidden();

  const session = await prisma.session.create({
    data: {
      clientId: parsed.data.clientId,
      trainerId: client.trainerId,
      scheduledAt: new Date(parsed.data.scheduledAt),
      startTime: parsed.data.startTime ? new Date(parsed.data.startTime) : null,
      endTime: parsed.data.endTime ? new Date(parsed.data.endTime) : null,
      status: parsed.data.status,
      notes: parsed.data.notes,
    },
    include: { client: true },
  });

  if (parsed.data.status === "COMPLETED") {
    const activeSub = await prisma.pTSubscription.findFirst({
      where: {
        clientId: client.id,
        status: { in: ["ACTIVE", "EXPIRING"] },
      },
      orderBy: { endDate: "desc" },
    });
    if (activeSub?.sessionsTotal) {
      await prisma.pTSubscription.update({
        where: { id: activeSub.id },
        data: { sessionsUsed: { increment: 1 } },
      });
    }
  }

  return ok(session, 201);
}

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canManageClients(user.role)) return forbidden();

  const body = await request.json();
  if (!body.id) return badRequest("Session id required");

  const existing = await prisma.session.findFirst({
    where: { id: body.id },
    include: { client: true },
  });
  if (!existing || existing.client.gymId !== user.gymId) return badRequest("Not found");
  if (user.role === "TRAINER" && existing.trainerId !== user.employeeId) return forbidden();

  const session = await prisma.session.update({
    where: { id: body.id },
    data: {
      status: body.status,
      startTime: body.startTime ? new Date(body.startTime) : undefined,
      endTime: body.endTime ? new Date(body.endTime) : undefined,
      notes: body.notes,
    },
    include: { client: true },
  });

  return ok(session);
}
