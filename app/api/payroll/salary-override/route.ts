import { prisma } from "@/lib/prisma";
import { getApiUser, unauthorized, forbidden, ok, badRequest } from "@/lib/api-utils";
import { canRecordPayroll } from "@/lib/permissions";
import { setMonthlySalaryOverride } from "@/lib/services/salaries";

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canRecordPayroll(user.role)) return forbidden();

  const body = await request.json();
  const { employeeId, month, year, baseSalary } = body;

  if (!employeeId || !month || !year || baseSalary == null) {
    return badRequest("employeeId, month, year, baseSalary required");
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, gymId: user.gymId },
  });
  if (!employee) return badRequest("Employee not found");
  if (employee.employeeType === "TRAINER") {
    return badRequest("Use trainer profile to edit trainer base salary");
  }

  const override = await setMonthlySalaryOverride(
    employeeId,
    Number(month),
    Number(year),
    Number(baseSalary)
  );

  return ok(override);
}
