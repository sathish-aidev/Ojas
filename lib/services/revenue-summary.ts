import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/utils";
import { paymentsCollectedInMonthWhere } from "@/lib/services/trainer-split";
import { getCultSettlement } from "@/lib/services/cult-settlements";
import {
  resolveCultCashReceived,
  resolveCultPnlIncome,
  EXPENSE_CATEGORY_LABELS,
  type CultIncomeSource,
} from "@/lib/revenue-constants";
import { shiftMonth } from "@/lib/date-ymd";
import type { ExpenseCategory } from "@prisma/client";
import { PNL_EXPENSE_KINDS, sumPnlExpenses } from "@/lib/services/expense-kinds";

export type RevenueMonthSummary = {
  month: number;
  year: number;
  cultIncome: number;
  cultIncomeSource: CultIncomeSource;
  cultIncomeLabel: string;
  partnerShare: number | null;
  taxInvoiceGrossTotal: number | null;
  ownerPtShare: number;
  ptRevenue: number;
  trainerPtShare: number;
  ptByTrainer: Array<{
    trainerId: string;
    trainerName: string;
    ownerShare: number;
    trainerShare: number;
    revenue: number;
  }>;
  manualExpenses: number;
  supervisorSpends: number;
  expensesByCategory: Array<{
    category: ExpenseCategory;
    label: string;
    amount: number;
  }>;
  payrollPaid: number;
  payrollPending: number;
  payrollRuns: Array<{
    id: string;
    employeeName: string;
    netPay: number;
    status: string;
  }>;
  totalCosts: number;
  grossIncome: number;
  netResult: number;
  moneyReceived: number | null;
  rds: number | null;
  moneyReceivedLabel: string;
  usedMoneyReceived: boolean;
  settlement: Awaited<ReturnType<typeof getCultSettlement>>;
};

async function getPtTotals(gymId: string, month: number, year: number) {
  const payments = await prisma.payment.findMany({
    where: {
      ...paymentsCollectedInMonthWhere(month, year),
      subscription: { client: { gymId } },
    },
    include: {
      subscription: {
        include: {
          client: { include: { trainer: { include: { user: true } } } },
        },
      },
    },
  });

  const byTrainer = new Map<
    string,
    { trainerId: string; trainerName: string; ownerShare: number; trainerShare: number; revenue: number }
  >();

  let ownerPtShare = 0;
  let trainerPtShare = 0;
  let ptRevenue = 0;

  for (const payment of payments) {
    const ownerShare = decimalToNumber(payment.ownerShareAmount);
    const trainerShare = decimalToNumber(payment.trainerShareAmount);
    const revenue = decimalToNumber(payment.amount);
    ownerPtShare += ownerShare;
    trainerPtShare += trainerShare;
    ptRevenue += revenue;

    const trainer = payment.subscription.client.trainer;
    const current = byTrainer.get(trainer.id) ?? {
      trainerId: trainer.id,
      trainerName: trainer.user.name,
      ownerShare: 0,
      trainerShare: 0,
      revenue: 0,
    };
    current.ownerShare += ownerShare;
    current.trainerShare += trainerShare;
    current.revenue += revenue;
    byTrainer.set(trainer.id, current);
  }

  return {
    ownerPtShare,
    trainerPtShare,
    ptRevenue,
    ptByTrainer: [...byTrainer.values()].sort((a, b) => b.ownerShare - a.ownerShare),
  };
}

async function getExpenseTotals(gymId: string, month: number, year: number) {
  const expenses = await prisma.gymExpense.findMany({
    where: { gymId, month, year },
  });
  const byCategory = new Map<ExpenseCategory, number>();
  const kindRows = expenses.map((expense) => ({
    kind: expense.kind,
    amount: decimalToNumber(expense.amount),
  }));
  const manualExpenses = sumPnlExpenses(kindRows);
  let supervisorSpends = 0;
  for (const expense of expenses) {
    const amount = decimalToNumber(expense.amount);
    if (expense.kind === "SUPERVISOR_SPEND") {
      supervisorSpends += amount;
      continue;
    }
      if (!PNL_EXPENSE_KINDS.includes(expense.kind)) continue;
    byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + amount);
  }
  const expensesByCategory = [...byCategory.entries()]
    .map(([category, amount]) => ({
      category,
      label: EXPENSE_CATEGORY_LABELS[category],
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);
  return { manualExpenses, supervisorSpends, expensesByCategory };
}

async function getPayrollTotals(gymId: string, month: number, year: number) {
  const runs = await prisma.payrollRun.findMany({
    where: { month, year, employee: { gymId } },
    include: { employee: { include: { user: true } } },
    orderBy: { employee: { user: { name: "asc" } } },
  });

  let payrollPaid = 0;
  let payrollPending = 0;
  const payrollRuns = runs.map((run) => {
    const netPay = decimalToNumber(run.netPay);
    if (run.status === "PAID") payrollPaid += netPay;
    else payrollPending += netPay;
    return {
      id: run.id,
      employeeName: run.employee.user.name,
      netPay,
      status: run.status,
    };
  });

  return { payrollPaid, payrollPending, payrollRuns };
}

export async function getRevenueMonthSummary(
  gymId: string,
  month: number,
  year: number
): Promise<RevenueMonthSummary> {
  const [settlement, pt, expenses, payroll] = await Promise.all([
    getCultSettlement(gymId, month, year),
    getPtTotals(gymId, month, year),
    getExpenseTotals(gymId, month, year),
    getPayrollTotals(gymId, month, year),
  ]);

  const cashInput = {
    partnerShare: settlement?.partnerShare ?? null,
    taxInvoiceGrossTotal: settlement?.taxInvoiceGrossTotal ?? null,
    centerCollections: settlement?.centerCollections ?? null,
    midMonthPayment: settlement?.midMonthPayment ?? null,
    grossPayable: settlement?.grossPayable ?? null,
    tds: settlement?.tds ?? null,
  };
  const cult = resolveCultPnlIncome(cashInput);
  const cash = resolveCultCashReceived(cashInput);
  const grossIncome = cult.amount + pt.ownerPtShare;
  const totalCosts = expenses.manualExpenses + payroll.payrollPaid;

  return {
    month,
    year,
    cultIncome: cult.amount,
    cultIncomeSource: cult.source,
    cultIncomeLabel: cult.label,
    partnerShare: settlement?.partnerShare ?? null,
    taxInvoiceGrossTotal: settlement?.taxInvoiceGrossTotal ?? null,
    ownerPtShare: pt.ownerPtShare,
    ptRevenue: pt.ptRevenue,
    trainerPtShare: pt.trainerPtShare,
    ptByTrainer: pt.ptByTrainer,
    manualExpenses: expenses.manualExpenses,
    supervisorSpends: expenses.supervisorSpends,
    expensesByCategory: expenses.expensesByCategory,
    payrollPaid: payroll.payrollPaid,
    payrollPending: payroll.payrollPending,
    payrollRuns: payroll.payrollRuns,
    totalCosts,
    grossIncome,
    netResult: grossIncome - totalCosts,
    moneyReceived: cash.moneyReceived,
    rds: cash.rds,
    moneyReceivedLabel: cash.label,
    usedMoneyReceived: cult.usedMoneyReceived,
    settlement,
  };
}

export async function getRevenueTrend(
  gymId: string,
  month: number,
  year: number,
  monthsBack = 12
) {
  const keys = Array.from({ length: monthsBack }, (_, i) =>
    shiftMonth(month, year, -(monthsBack - 1 - i))
  );
  const summaries = await Promise.all(
    keys.map((key) => getRevenueMonthSummary(gymId, key.month, key.year))
  );
  return summaries.map((summary) => ({
    month: summary.month,
    year: summary.year,
    label: `${String(summary.month).padStart(2, "0")}/${summary.year}`,
    cultIncome: summary.cultIncome,
    cultIncomeSource: summary.cultIncomeSource,
    ownerPtShare: summary.ownerPtShare,
    rds: summary.rds,
    moneyReceived: summary.moneyReceived,
    usedMoneyReceived: summary.usedMoneyReceived,
    manualExpenses: summary.manualExpenses,
    payrollPaid: summary.payrollPaid,
    totalCosts: summary.totalCosts,
    grossIncome: summary.grossIncome,
    netResult: summary.netResult,
  }));
}
