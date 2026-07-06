import { prisma } from "@/lib/prisma";
import { getApiUser, unauthorized, forbidden, notFound } from "@/lib/api-utils";
import { generatePayStubPdf } from "@/lib/pdf/generate-pay-stub";
import { decimalToNumber } from "@/lib/utils";
import {
  getTrainerMonthlyReport,
  getTrainerMonthlyReportFromSnapshot,
  type TrainerMonthlyReportRow,
} from "@/lib/services/trainer-monthly-report";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApiUser();
  if (!user) return unauthorized();

  const { id } = await params;
  const payroll = await prisma.payrollRun.findFirst({
    where: { id },
    include: {
      employee: { include: { user: true, gym: true } },
      lineItems: true,
    },
  });

  if (!payroll || payroll.employee.gymId !== user.gymId) return notFound();

  if (user.role === "TRAINER") {
    if (user.employeeId !== payroll.employeeId) return forbidden();
  }

  let reportRows: TrainerMonthlyReportRow[] | undefined;

  function snapshotDate(row: Record<string, unknown>, ...keys: string[]): Date {
    for (const key of keys) {
      const value = row[key];
      if (value instanceof Date) return value;
      if (typeof value === "string" || typeof value === "number") return new Date(value);
    }
    throw new Error(`Snapshot row missing date (${keys.join(" | ")})`);
  }

  const snapshot = await getTrainerMonthlyReportFromSnapshot(payroll.id);
  if (snapshot) {
    reportRows = snapshot.rows.map((row) => {
      const raw = row as TrainerMonthlyReportRow & Record<string, unknown>;
      return {
        ...row,
        subscriptionStart: snapshotDate(raw, "subscriptionStart"),
        subscriptionEnd: snapshotDate(raw, "subscriptionEnd"),
        serviceMonth: snapshotDate(raw, "serviceMonth", "paidAt"),
        paidOn: snapshotDate(raw, "paidOn", "collectedAt", "paidAt"),
        amountPaidThisMonth:
          row.amountPaidThisMonth !== undefined && row.amountPaidThisMonth !== null
            ? row.amountPaidThisMonth
            : typeof raw.installmentAmount === "number"
              ? raw.installmentAmount
              : null,
        monthsCount: row.monthsCount ?? 1,
        monthlyShare:
          row.monthlyShare ??
          row.amountPaidThisMonth ??
          (typeof raw.installmentAmount === "number" ? raw.installmentAmount : 0),
        payableAt: raw.payableAt ? snapshotDate(raw, "payableAt") : null,
      };
    });
  } else if (payroll.employee.employeeType === "TRAINER") {
    const live = await getTrainerMonthlyReport(
      payroll.employeeId,
      payroll.month,
      payroll.year
    );
    reportRows = live?.rows;
  }

  const buffer = await generatePayStubPdf({
    gymName: payroll.employee.gym.name,
    employeeName: payroll.employee.user.name,
    employeeType: payroll.employee.employeeType,
    month: payroll.month,
    year: payroll.year,
    baseSalary: decimalToNumber(payroll.baseSalary),
    commission: decimalToNumber(payroll.commission),
    incentives: decimalToNumber(payroll.incentives),
    deductions: decimalToNumber(payroll.deductions),
    expenses: decimalToNumber(payroll.expenses),
    grossPay: decimalToNumber(payroll.grossPay),
    netPay: decimalToNumber(payroll.netPay),
    paidAt: payroll.paidAt,
    lineItems: payroll.lineItems.map((item) => ({
      label: item.label,
      amount: decimalToNumber(item.amount),
      isDeduction: item.isDeduction,
    })),
    reportRows,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="paystub-${payroll.employee.user.name}-${payroll.month}-${payroll.year}.pdf"`,
    },
  });
}
