import { prisma } from "@/lib/prisma";
import {
  getApiUser,
  unauthorized,
  forbidden,
  badRequest,
  ok,
  requireGymUser,
  handlePrismaError,
} from "@/lib/api-utils";
import { canManageClients } from "@/lib/permissions";
import { parseClientCreateRequest, validateClientCreate } from "@/lib/parse-client-request";
import { createSubscriptionWithPayment } from "@/lib/services/pt-tracker";
import { saveUploadedImage } from "@/lib/upload/save-image";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const trainerId = searchParams.get("trainerId");

  const where: Record<string, unknown> = { gymId: user.gymId };
  if (user.role === "TRAINER" && user.employeeId) {
    where.trainerId = user.employeeId;
  } else if (trainerId) {
    where.trainerId = trainerId;
  }

  const clients = await prisma.client.findMany({
    where,
    include: {
      trainer: { include: { user: true } },
      subscriptions: { orderBy: { endDate: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  return ok(clients);
}

export async function POST(request: Request) {
  try {
    const authResult = await requireGymUser();
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;

    if (!canManageClients(user.role)) return forbidden();

    const { data: rawData, proofFile } = await parseClientCreateRequest(request);
    const parsed = validateClientCreate(rawData);
    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");
    }

    let trainerId = parsed.data.trainerId;
    if (user.role === "TRAINER") {
      if (!user.employeeId) return forbidden();
      trainerId = user.employeeId;
    }
    if (!trainerId) return badRequest("Trainer is required");

    let proofUrl: string | undefined;
    if (proofFile) {
      try {
        proofUrl = await saveUploadedImage(proofFile, "payments");
      } catch (err) {
        return badRequest(err instanceof Error ? err.message : "Upload failed");
      }
    }

    const client = await prisma.client.create({
      data: {
        gymId: user.gymId,
        trainerId,
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        joinDate: parsed.data.joinDate ? new Date(parsed.data.joinDate) : new Date(),
      },
      include: { trainer: { include: { user: true } } },
    });

    if (parsed.data.amount && parsed.data.startDate && parsed.data.endDate) {
      await createSubscriptionWithPayment({
        clientId: client.id,
        amount: parsed.data.amount,
        paymentDate: new Date(parsed.data.paymentDate ?? parsed.data.startDate),
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        monthsCount: parsed.data.monthsCount,
        paymentMode: parsed.data.paymentMode,
        proofUrl,
        sessionsTotal: parsed.data.sessionsTotal,
        notes: parsed.data.ptNotes,
      });
    }

    const fullClient = await prisma.client.findUnique({
      where: { id: client.id },
      include: {
        trainer: { include: { user: true } },
        subscriptions: { orderBy: { endDate: "desc" }, take: 1 },
      },
    });

    return ok(fullClient ?? client, 201);
  } catch (error) {
    return handlePrismaError(error);
  }
}
