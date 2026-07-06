import { prisma } from "@/lib/prisma";
import { getApiUser, unauthorized, forbidden, badRequest, ok } from "@/lib/api-utils";
import { canRecordPayroll, canEditSalaryRules } from "@/lib/permissions";
import { payrollGenerateSchema, payrollPaySchema } from "@/lib/validations";
import {
  generatePayrollForGym,
  getSalariesOverview,
  markPayrollPaid,
  updatePayrollAdjustments,
} from "@/lib/services/salaries";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (user.role === "TRAINER") return forbidden();

  const { searchParams } = new URL(request.url);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  const overview = await getSalariesOverview(user.gymId, month, year);
  return ok(overview);
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();

  const body = await request.json();

  if (body.action === "generate") {
    if (!canEditSalaryRules(user.role)) return forbidden();
    const parsed = payrollGenerateSchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid month/year");
    const runs = await generatePayrollForGym(user.gymId, parsed.data.month, parsed.data.year);
    return ok(runs, 201);
  }

  if (body.action === "pay") {
    if (!canRecordPayroll(user.role)) return forbidden();
    const parsed = payrollPaySchema.safeParse(body);
    if (!parsed.success) return badRequest("Invalid input");
    const payroll = await prisma.payrollRun.findFirst({
      where: { id: parsed.data.payrollRunId },
      include: { employee: true },
    });
    if (!payroll || payroll.employee.gymId !== user.gymId) return forbidden();
    const updated = await markPayrollPaid(
      parsed.data.payrollRunId,
      parsed.data.paidAt ? new Date(parsed.data.paidAt) : undefined,
      parsed.data.notes
    );
    return ok(updated);
  }

  if (body.action === "adjust") {
    if (!canEditSalaryRules(user.role)) return forbidden();
    const payroll = await prisma.payrollRun.findFirst({
      where: { id: body.payrollRunId },
      include: { employee: true },
    });
    if (!payroll || payroll.employee.gymId !== user.gymId) return forbidden();
    const updated = await updatePayrollAdjustments(body.payrollRunId, body);
    return ok(updated);
  }

  return badRequest("Unknown action");
}
