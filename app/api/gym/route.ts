import { prisma } from "@/lib/prisma";
import { getApiUser, unauthorized, forbidden, badRequest, ok } from "@/lib/api-utils";
import { canEditSalaryRules } from "@/lib/permissions";
import { gymSettingsSchema } from "@/lib/validations";
import { getRenewalPipeline } from "@/lib/services/pt-tracker";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (type === "renewals") {
    const days = parseInt(searchParams.get("days") ?? "30");
    const renewals = await getRenewalPipeline(user.gymId, days);
    return ok(renewals);
  }

  const gym = await prisma.gym.findUnique({ where: { id: user.gymId } });
  return ok(gym);
}

export async function PATCH(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canEditSalaryRules(user.role)) return forbidden();

  const body = await request.json();
  const parsed = gymSettingsSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid settings");

  const gym = await prisma.gym.update({
    where: { id: user.gymId },
    data: parsed.data,
  });

  return ok(gym);
}
