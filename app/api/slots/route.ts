import { prisma } from "@/lib/prisma";
import { getApiUser, unauthorized, forbidden, badRequest, ok } from "@/lib/api-utils";
import { canManageClients } from "@/lib/permissions";
import { slotSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const trainerId =
    user.role === "TRAINER" ? user.employeeId : searchParams.get("trainerId");
  if (!trainerId) return badRequest("trainerId required");

  const slots = await prisma.trainerSlot.findMany({
    where: { gymId: user.gymId, trainerId },
    orderBy: { startAt: "asc" },
  });

  return ok(slots);
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canManageClients(user.role)) return forbidden();

  const body = await request.json();
  const parsed = slotSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");

  const trainerId = user.role === "TRAINER" ? user.employeeId : body.trainerId;
  if (!trainerId) return badRequest("trainerId required");

  const slot = await prisma.trainerSlot.create({
    data: {
      gymId: user.gymId,
      trainerId,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      isBlocked: parsed.data.isBlocked,
      label: parsed.data.label,
      clientId: parsed.data.clientId,
    },
  });

  return ok(slot, 201);
}

export async function DELETE(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canManageClients(user.role)) return forbidden();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return badRequest("id required");

  const slot = await prisma.trainerSlot.findFirst({ where: { id, gymId: user.gymId } });
  if (!slot) return badRequest("Not found");
  if (user.role === "TRAINER" && slot.trainerId !== user.employeeId) return forbidden();

  await prisma.trainerSlot.delete({ where: { id } });
  return ok({ success: true });
}
