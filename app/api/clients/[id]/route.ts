import { prisma } from "@/lib/prisma";
import { getApiUser, unauthorized, forbidden, badRequest, ok, notFound } from "@/lib/api-utils";
import { canManageClients, canViewClient } from "@/lib/permissions";
import { clientSchema } from "@/lib/validations";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const client = await prisma.client.findFirst({
    where: { id, gymId: user.gymId },
    include: {
      trainer: { include: { user: true } },
      subscriptions: { orderBy: { endDate: "desc" }, include: { payments: true } },
      sessions: { orderBy: { scheduledAt: "desc" }, take: 20 },
      goals: true,
      measurements: { orderBy: { recordedAt: "desc" } },
      notes: { orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }] },
      dietPrograms: { orderBy: { createdAt: "desc" } },
      progressPhotos: { orderBy: { takenAt: "desc" } },
    },
  });

  if (!client) return notFound();
  if (!canViewClient(user.role, client.trainerId, user.employeeId)) return forbidden();

  return ok(client);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canManageClients(user.role)) return forbidden();

  const { id } = await params;
  const client = await prisma.client.findFirst({ where: { id, gymId: user.gymId } });
  if (!client) return notFound();
  if (user.role === "TRAINER" && client.trainerId !== user.employeeId) return forbidden();

  const body = await request.json();
  const parsed = clientSchema.partial().safeParse(body);
  if (!parsed.success) return badRequest("Invalid input");

  const updated = await prisma.client.update({
    where: { id },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      status: body.status,
    },
  });

  return ok(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canManageClients(user.role)) return forbidden();

  const { id } = await params;
  const client = await prisma.client.findFirst({ where: { id, gymId: user.gymId } });
  if (!client) return notFound();
  if (user.role === "TRAINER" && client.trainerId !== user.employeeId) return forbidden();

  await prisma.client.delete({ where: { id } });
  return ok({ success: true });
}
