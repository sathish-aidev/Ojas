import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/utils";
import {
  getTrainerMonthlyReport,
  serializeReport,
  type TrainerMonthlyReport,
} from "@/lib/services/trainer-monthly-report";

export async function calculateTrainerCommission(
  employeeId: string,
  month: number,
  year: number
) {
  const report = await getTrainerMonthlyReport(employeeId, month, year);
  return report?.summary.totalTrainerShare ?? 0;
}

function buildPayrollLineItems(
  baseSalary: number,
  commission: number,
  report: TrainerMonthlyReport | null
) {
  const items: Array<{ label: string; amount: number; isDeduction: boolean }> = [
    { label: "Base Salary", amount: baseSalary, isDeduction: false },
  ];

  if (report && report.rows.length > 0) {
    for (const row of report.rows) {
      items.push({
        label: `PT — ${row.clientName}`,
        amount: row.trainerShare,
        isDeduction: false,
      });
    }
  } else if (commission > 0) {
    items.push({ label: "PT Commission", amount: commission, isDeduction: false });
  }

  return items;
}

export async function resolveEmployeeBaseSalary(
  employeeId: string,
  defaultSalary: number,
  month: number,
  year: number
) {
  const override = await prisma.monthlySalaryOverride.findUnique({
    where: {
      employeeId_month_year: { employeeId, month, year },
    },
  });
  return override ? decimalToNumber(override.baseSalary) : defaultSalary;
}

export async function setMonthlySalaryOverride(
  employeeId: string,
  month: number,
  year: number,
  baseSalary: number
) {
  return prisma.monthlySalaryOverride.upsert({
    where: {
      employeeId_month_year: { employeeId, month, year },
    },
    create: { employeeId, month, year, baseSalary },
    update: { baseSalary },
  });
}

export async function generatePayrollForGym(gymId: string, month: number, year: number) {
  const employees = await prisma.employee.findMany({
    where: { gymId },
    include: { user: true },
  });

  const results = [];

  for (const employee of employees) {
    const defaultSalary = decimalToNumber(employee.baseSalary);
    const baseSalary =
      employee.employeeType !== "TRAINER"
        ? await resolveEmployeeBaseSalary(employee.id, defaultSalary, month, year)
        : defaultSalary;
    let commission = 0;
    let report: TrainerMonthlyReport | null = null;

    if (employee.employeeType === "TRAINER") {
      report = await getTrainerMonthlyReport(employee.id, month, year);
      commission = report?.summary.totalTrainerShare ?? 0;
    }

    const grossPay = baseSalary + commission;
    const netPay = grossPay;
    const lineItems = buildPayrollLineItems(baseSalary, commission, report);
    const reportSnapshot =
      employee.employeeType === "TRAINER" && report ? serializeReport(report) : undefined;

    const payroll = await prisma.payrollRun.upsert({
      where: {
        employeeId_month_year: {
          employeeId: employee.id,
          month,
          year,
        },
      },
      create: {
        employeeId: employee.id,
        month,
        year,
        baseSalary,
        commission,
        incentives: 0,
        deductions: 0,
        expenses: 0,
        grossPay,
        netPay,
        status: "PENDING",
        reportSnapshot,
        lineItems: { create: lineItems },
      },
      update: {
        baseSalary,
        commission,
        grossPay,
        netPay,
        reportSnapshot,
        lineItems: {
          deleteMany: {},
          create: lineItems,
        },
      },
      include: {
        employee: { include: { user: true } },
        lineItems: true,
      },
    });

    results.push(payroll);
  }

  return results;
}

export async function getPayrollHistory(employeeId: string, months = 12) {
  return prisma.payrollRun.findMany({
    where: { employeeId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: months,
    include: { lineItems: true },
  });
}

export async function markPayrollPaid(payrollRunId: string, paidAt?: Date, notes?: string) {
  return prisma.payrollRun.update({
    where: { id: payrollRunId },
    data: {
      status: "PAID",
      paidAt: paidAt ?? new Date(),
      notes,
    },
  });
}

export async function updatePayrollAdjustments(
  payrollRunId: string,
  data: {
    incentives?: number;
    deductions?: number;
    expenses?: number;
    notes?: string;
  }
) {
  const payroll = await prisma.payrollRun.findUnique({
    where: { id: payrollRunId },
    include: { lineItems: true },
  });
  if (!payroll) throw new Error("Payroll not found");

  const incentives = data.incentives ?? decimalToNumber(payroll.incentives);
  const deductions = data.deductions ?? decimalToNumber(payroll.deductions);
  const expenses = data.expenses ?? decimalToNumber(payroll.expenses);
  const baseSalary = decimalToNumber(payroll.baseSalary);
  const commission = decimalToNumber(payroll.commission);

  const grossPay = baseSalary + commission + incentives;
  const netPay = grossPay - deductions - expenses;

  const ptLineItems = payroll.lineItems.filter(
    (item) => item.label.startsWith("PT —") || item.label === "PT Commission"
  );
  const lineItems = [
    { label: "Base Salary", amount: baseSalary, isDeduction: false },
    ...ptLineItems.map((item) => ({
      label: item.label,
      amount: decimalToNumber(item.amount),
      isDeduction: false,
    })),
    ...(incentives > 0 ? [{ label: "Incentives", amount: incentives, isDeduction: false }] : []),
    ...(deductions > 0 ? [{ label: "Deductions", amount: deductions, isDeduction: true }] : []),
    ...(expenses > 0 ? [{ label: "Expenses", amount: expenses, isDeduction: true }] : []),
  ];

  return prisma.payrollRun.update({
    where: { id: payrollRunId },
    data: {
      incentives,
      deductions,
      expenses,
      grossPay,
      netPay,
      notes: data.notes ?? payroll.notes,
      lineItems: {
        deleteMany: {},
        create: lineItems,
      },
    },
    include: { employee: { include: { user: true } }, lineItems: true },
  });
}

export async function getSalariesOverview(gymId: string, month: number, year: number) {
  const employees = await prisma.employee.findMany({
    where: { gymId },
    include: {
      user: true,
      payrollRuns: {
        where: { month, year },
        include: { lineItems: true },
      },
      salaryOverrides: {
        where: { month, year },
      },
    },
  });

  return employees.map((emp) => {
    const payroll = emp.payrollRuns[0];
    const override = emp.salaryOverrides[0];
    const defaultSalary = decimalToNumber(emp.baseSalary);
    return {
      employee: {
        id: emp.id,
        employeeType: emp.employeeType,
        user: { name: emp.user.name },
        defaultSalary,
      },
      salaryOverride:
        override != null ? decimalToNumber(override.baseSalary) : null,
      payroll: payroll
        ? {
            id: payroll.id,
            month: payroll.month,
            year: payroll.year,
            baseSalary: decimalToNumber(payroll.baseSalary),
            commission: decimalToNumber(payroll.commission),
            incentives: decimalToNumber(payroll.incentives),
            netPay: decimalToNumber(payroll.netPay),
            status: payroll.status,
            hasSnapshot: !!payroll.reportSnapshot,
          }
        : null,
    };
  });
}
