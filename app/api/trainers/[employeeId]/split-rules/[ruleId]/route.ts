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
import { splitRuleUpdateSchema } from "@/lib/validations";
import {
  updateSplitRule,
  deleteSplitRule,
} from "@/lib/services/trainer-split-rules";

async function getRuleInGym(ruleId: string, gymId: string) {
  return prisma.trainerSplitRule.findFirst({
    where: { id: ruleId, employee: { gymId, employeeType: "TRAINER" } },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ employeeId: string; ruleId: string }> }
) {
  try {
    const authResult = await requireGymUser();
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;

    if (!canEditSalaryRules(user.role)) return forbidden();

    const { ruleId } = await params;
    const existing = await getRuleInGym(ruleId, user.gymId);
    if (!existing) return notFound("Rule not found");

    const body = await request.json();
    const parsed = splitRuleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");
    }

    const { recalculate, ...input } = parsed.data;
    const result = await updateSplitRule(ruleId, input, recalculate !== false);

    return ok({
      rule: result.rule,
      monthsRecalculated: result.monthsRecalculated,
    });
  } catch (error) {
    if (error instanceof Error) return badRequest(error.message);
    return handlePrismaError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ employeeId: string; ruleId: string }> }
) {
  try {
    const authResult = await requireGymUser();
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;

    if (!canEditSalaryRules(user.role)) return forbidden();

    const { ruleId } = await params;
    const existing = await getRuleInGym(ruleId, user.gymId);
    if (!existing) return notFound("Rule not found");

    const url = new URL(request.url);
    const recalculate = url.searchParams.get("recalculate") !== "false";
    const result = await deleteSplitRule(ruleId, recalculate);

    return ok({ monthsRecalculated: result.monthsRecalculated });
  } catch (error) {
    if (error instanceof Error) return badRequest(error.message);
    return handlePrismaError(error);
  }
}
