import { prisma } from "@/lib/prisma";
import {
  forbidden,
  badRequest,
  ok,
  requireGymUser,
  handlePrismaError,
} from "@/lib/api-utils";
import { canManageClients } from "@/lib/permissions";
import { subscriptionSchema } from "@/lib/validations";
import { createSubscriptionWithPayment } from "@/lib/services/pt-tracker";
import { saveUploadedImage } from "@/lib/upload/save-image";

function parseSubscriptionFormData(form: FormData): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (key === "proof") continue;
    if (typeof value === "string") data[key] = value;
  }
  return data;
}

export async function POST(request: Request) {
  try {
    const authResult = await requireGymUser();
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;

    if (!canManageClients(user.role)) return forbidden();

    const contentType = request.headers.get("content-type") ?? "";
    let proofFile: File | null = null;
    let rawData: Record<string, unknown>;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const proof = form.get("proof");
      proofFile = proof instanceof File && proof.size > 0 ? proof : null;
      rawData = parseSubscriptionFormData(form);
    } else {
      rawData = await request.json();
    }

    const parsed = subscriptionSchema.safeParse(rawData);
    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");
    }

    const client = await prisma.client.findFirst({
      where: { id: parsed.data.clientId, gymId: user.gymId },
    });
    if (!client) return badRequest("Client not found");
    if (user.role === "TRAINER" && client.trainerId !== user.employeeId) return forbidden();

    let proofUrl: string | undefined;
    if (proofFile) {
      try {
        proofUrl = await saveUploadedImage(proofFile, "payments");
      } catch (err) {
        return badRequest(err instanceof Error ? err.message : "Upload failed");
      }
    }

    const subscription = await createSubscriptionWithPayment({
      clientId: parsed.data.clientId,
      amount: parsed.data.amount,
      paymentDate: new Date(parsed.data.paymentDate),
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      monthsCount: parsed.data.monthsCount,
      paymentMode: parsed.data.paymentMode,
      proofUrl,
      sessionsTotal: parsed.data.sessionsTotal,
      notes: parsed.data.notes,
    });

    return ok(subscription, 201);
  } catch (error) {
    return handlePrismaError(error);
  }
}
