import { prisma } from "@/lib/prisma";
import { getApiUser, unauthorized, forbidden, ok, badRequest } from "@/lib/api-utils";
import { canRecordPayroll } from "@/lib/permissions";
import { setMonthlyNetPay } from "@/lib/services/salaries";

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canRecordPayroll(user.role)) return forbidden();

  const body = await request.json();
  const { employeeId, month, year, netPay, baseSalary } = body;
  const paid = netPay ?? baseSalary;

  if (!employeeId || !month || !year || paid == null) {
    return badRequest("employeeId, month, year, and netPay are required");
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, gymId: user.gymId },
  });
  if (!employee) return badRequest("Employee not found");

  try {
    const payroll = await setMonthlyNetPay(
      employeeId,
      Number(month),
      Number(year),
      Number(paid)
    );
    return ok(payroll);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Could not save paid amount");
  }
}
