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
import { splitRuleApplySchema } from "@/lib/validations";
import { recalculateAffectedMonths } from "@/lib/services/trainer-split-rules";

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
    const trainer = await prisma.employee.findFirst({
      where: { id: employeeId, gymId: user.gymId, employeeType: "TRAINER" },
    });
    if (!trainer) return notFound("Trainer not found");

    const body = await request.json();
    const parsed = splitRuleApplySchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");
    }

    const { fromMonth, fromYear, toMonth, toYear } = parsed.data;
    const monthsRecalculated = await recalculateAffectedMonths(
      employeeId,
      fromMonth,
      fromYear,
      toMonth,
      toYear
    );

    return ok({ monthsRecalculated });
  } catch (error) {
    if (error instanceof Error) return badRequest(error.message);
    return handlePrismaError(error);
  }
}
