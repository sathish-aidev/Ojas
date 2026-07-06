import { prisma } from "@/lib/prisma";
import {
  requireGymUser,
  forbidden,
  notFound,
  badRequest,
  ok,
  handlePrismaError,
} from "@/lib/api-utils";
import { canEditSalaryRules } from "@/lib/permissions";
import { splitRuleSchema } from "@/lib/validations";
import {
  listSplitRules,
  createSplitRule,
} from "@/lib/services/trainer-split-rules";

async function getTrainerInGym(employeeId: string, gymId: string) {
  return prisma.employee.findFirst({
    where: { id: employeeId, gymId, employeeType: "TRAINER" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const authResult = await requireGymUser();
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;

    const { employeeId } = await params;
    const trainer = await getTrainerInGym(employeeId, user.gymId);
    if (!trainer) return notFound("Trainer not found");

    const rules = await listSplitRules(employeeId);
    return ok({ rules });
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const authResult = await requireGymUser();
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;

    if (!canEditSalaryRules(user.role)) return forbidden();

    const { employeeId } = await params;
    const trainer = await getTrainerInGym(employeeId, user.gymId);
    if (!trainer) return notFound("Trainer not found");

    const body = await request.json();
    const parsed = splitRuleSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");
    }

    const { recalculate, ...input } = parsed.data;
    const result = await createSplitRule(employeeId, input, recalculate !== false);

    return ok({
      rule: result.rule,
      monthsRecalculated: result.monthsRecalculated,
    });
  } catch (error) {
    if (error instanceof Error) return badRequest(error.message);
    return handlePrismaError(error);
  }
}
