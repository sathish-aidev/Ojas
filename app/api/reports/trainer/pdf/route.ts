import { prisma } from "@/lib/prisma";
import { getApiUser, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { generateTrainerReportPdf } from "@/lib/pdf/generate-trainer-report";
import { getTrainerMonthlyReport } from "@/lib/services/trainer-monthly-report";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));
  let trainerId = searchParams.get("trainerId");

  if (!month || !year) return badRequest("month and year are required");

  if (user.role === "TRAINER") {
    if (!user.employeeId) return forbidden();
    trainerId = user.employeeId;
  } else if (user.role !== "OWNER" && user.role !== "SUPERVISOR") {
    return forbidden();
  }

  if (!trainerId) return badRequest("trainerId is required");

  const employee = await prisma.employee.findFirst({
    where: { id: trainerId, gymId: user.gymId, employeeType: "TRAINER" },
    include: { user: true, gym: true },
  });

  if (!employee) return forbidden();

  const report = await getTrainerMonthlyReport(trainerId, month, year);
  if (!report) return badRequest("Could not build report");

  const buffer = await generateTrainerReportPdf(employee.gym.name, report);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="pt-report-${employee.user.name}-${month}-${year}.pdf"`,
    },
  });
}
