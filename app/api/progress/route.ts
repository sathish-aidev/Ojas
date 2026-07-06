import { prisma } from "@/lib/prisma";
import { getApiUser, unauthorized, forbidden, badRequest, ok } from "@/lib/api-utils";
import { canManageClients } from "@/lib/permissions";
import { goalSchema, measurementSchema, noteSchema, dietSchema } from "@/lib/validations";
import {
  addGoal,
  addMeasurement,
  addClientNote,
  addDietProgram,
  addProgressPhoto,
} from "@/lib/services/client-progress";
import { saveUploadedImage } from "@/lib/upload/save-image";

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canManageClients(user.role)) return forbidden();

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const type = form.get("type") as string;
    const clientId = form.get("clientId") as string;

    const client = await prisma.client.findFirst({ where: { id: clientId, gymId: user.gymId } });
    if (!client) return badRequest("Client not found");
    if (user.role === "TRAINER" && client.trainerId !== user.employeeId) return forbidden();

    if (type === "photo") {
      const file = form.get("file") as File | null;
      if (!file) return badRequest("File required");

      let imageUrl: string;
      try {
        imageUrl = await saveUploadedImage(file);
      } catch (err) {
        return badRequest(err instanceof Error ? err.message : "Upload failed");
      }

      const photo = await addProgressPhoto({
        clientId,
        imageUrl,
        caption: (form.get("caption") as string) || undefined,
      });
      return ok(photo, 201);
    }

    return badRequest("Unknown upload type");
  }

  const body = await request.json();
  const client = await prisma.client.findFirst({
    where: { id: body.clientId, gymId: user.gymId },
  });
  if (!client) return badRequest("Client not found");
  if (user.role === "TRAINER" && client.trainerId !== user.employeeId) return forbidden();

  switch (body.type) {
    case "goal": {
      const parsed = goalSchema.safeParse(body);
      if (!parsed.success) return badRequest("Invalid goal");
      const goal = await addGoal({
        ...parsed.data,
        deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : undefined,
      });
      return ok(goal, 201);
    }
    case "measurement": {
      const parsed = measurementSchema.safeParse(body);
      if (!parsed.success) return badRequest("Invalid measurement");
      const measurement = await addMeasurement({
        ...parsed.data,
        recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : undefined,
      });
      return ok(measurement, 201);
    }
    case "note": {
      const parsed = noteSchema.safeParse(body);
      if (!parsed.success) return badRequest("Invalid note");
      const note = await addClientNote(parsed.data);
      return ok(note, 201);
    }
    case "diet": {
      const parsed = dietSchema.safeParse(body);
      if (!parsed.success) return badRequest("Invalid diet program");
      const diet = await addDietProgram({
        ...parsed.data,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      });
      return ok(diet, 201);
    }
    default:
      return badRequest("Unknown progress type");
  }
}
