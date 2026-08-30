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
  incentives = 0,
  deductions = 0,
  expenses = 0
) {
  const items: Array<{ label: string; amount: number; isDeduction: boolean }> = [
    { label: "Base Salary", amount: baseSalary, isDeduction: false },
  ];

  if (commission > 0) {
    items.push({ label: "PT Share", amount: commission, isDeduction: false });
  }
  if (incentives !== 0) {
    items.push({ label: "Incentives", amount: incentives, isDeduction: false });
  }
  if (deductions > 0) {
    items.push({ label: "Deductions", amount: deductions, isDeduction: true });
  }
  if (expenses > 0) {
    items.push({ label: "Expenses", amount: expenses, isDeduction: true });
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

export async function generatePayrollForEmployee(
  employeeId: string,
  month: number,
  year: number,
  options?: { skipIfPaid?: boolean }
) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      user: true,
      payrollRuns: {
        where: { month, year },
        include: {
          employee: { include: { user: true } },
          lineItems: true,
        },
      },
    },
  });
  if (!employee) throw new Error("Employee not found");

  const existing = employee.payrollRuns[0];
  if (options?.skipIfPaid !== false && existing?.status === "PAID") {
    return existing;
  }

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

  const incentives = existing ? decimalToNumber(existing.incentives) : 0;
  const deductions = existing ? decimalToNumber(existing.deductions) : 0;
  const expenses = existing ? decimalToNumber(existing.expenses) : 0;
  const grossPay = baseSalary + commission + incentives;
  const netPay = grossPay - deductions - expenses;
  const lineItems = buildPayrollLineItems(
    baseSalary,
    commission,
    incentives,
    deductions,
    expenses
  );
  const reportSnapshot =
    employee.employeeType === "TRAINER" && report ? serializeReport(report) : undefined;

  return prisma.payrollRun.upsert({
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
      grossPay: baseSalary + commission,
      netPay: baseSalary + commission,
      status: "PENDING",
      reportSnapshot,
      lineItems: {
        create: buildPayrollLineItems(baseSalary, commission),
      },
    },
    update: {
      baseSalary,
      commission,
      incentives,
      deductions,
      expenses,
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
}

export async function setMonthlyNetPay(
  employeeId: string,
  month: number,
  year: number,
  netPayInput: number
) {
  const netPay = Math.round(Number(netPayInput) * 100) / 100;
  if (!Number.isFinite(netPay) || netPay < 0) {
    throw new Error("Paid amount must be 0 or more");
  }

  let payroll = await prisma.payrollRun.findUnique({
    where: { employeeId_month_year: { employeeId, month, year } },
  });
  if (!payroll) {
    payroll = await generatePayrollForEmployee(employeeId, month, year, { skipIfPaid: false });
  }

  const baseSalary = decimalToNumber(payroll.baseSalary);
  const commission = decimalToNumber(payroll.commission);
  const deductions = decimalToNumber(payroll.deductions);
  const expenses = decimalToNumber(payroll.expenses);
  const incentives = Math.round((netPay - baseSalary - commission + deductions + expenses) * 100) / 100;
  const grossPay = baseSalary + commission + incentives;
  const lineItems = buildPayrollLineItems(
    baseSalary,
    commission,
    incentives,
    deductions,
    expenses
  );

  return prisma.payrollRun.update({
    where: { id: payroll.id },
    data: {
      incentives,
      grossPay,
      netPay,
      lineItems: {
        deleteMany: {},
        create: lineItems,
      },
    },
    include: { employee: { include: { user: true } }, lineItems: true },
  });
}

export async function generatePayrollForGym(gymId: string, month: number, year: number) {
  const employees = await prisma.employee.findMany({
    where: { gymId },
    select: { id: true },
  });

  const results = [];
  for (const employee of employees) {
    // Paid runs are skipped inside generatePayrollForEmployee (mark Unpaid first).
    results.push(await generatePayrollForEmployee(employee.id, month, year));
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

export async function markPayrollUnpaid(payrollRunId: string) {
  return prisma.payrollRun.update({
    where: { id: payrollRunId },
    data: {
      status: "PENDING",
      paidAt: null,
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

  const lineItems = buildPayrollLineItems(
    baseSalary,
    commission,
    incentives,
    deductions,
    expenses
  );

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
