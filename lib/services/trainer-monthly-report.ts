import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/utils";
import {
  getTrainerMonthlyPtRevenue,
  paymentsWithServiceMonthWhere,
  paymentsCollectedInMonthWhere,
  getPaymentCollectionDate,
  recalculateTrainerMonthSplits,
  resolveSplitForMonth,
  getSplitStatusFromResolution,
} from "@/lib/services/trainer-split";
import {
  allocateMonthlyInstallments,
  inferMonthsCount,
} from "@/lib/services/payment-allocation";

export type TrainerMonthlyReportRow = {
  paymentId: string;
  clientId: string;
  clientName: string;
  subscriptionStart: Date;
  subscriptionEnd: Date;
  monthsCount: number;
  /** Standard monthly PT amount from the package (total ÷ months). */
  monthlyShare: number;
  /** Total cash collected from this subscription in the report month; null if none. */
  amountPaidThisMonth: number | null;
  trainerShare: number;
  splitPercent: number;
  /** When the client actually paid (collection date). */
  paidOn: Date;
  /** Service month this installment covers (may differ from collection month). */
  serviceMonth: Date;
  payableAt: Date | null;
  installmentIndex: number | null;
};

function resolvePackageMonths(sub: {
  monthsCount: number | null;
  startDate: Date;
  endDate: Date;
}): number {
  if (sub.monthsCount && sub.monthsCount > 0) return sub.monthsCount;
  return inferMonthsCount(sub.startDate, sub.endDate);
}

function resolveMonthlyShare(
  packageAmount: number,
  startDate: Date,
  monthsCount: number,
  installmentIndex: number | null
): number {
  const installments = allocateMonthlyInstallments(packageAmount, startDate, monthsCount);
  const idx = installmentIndex ?? 0;
  if (installments[idx]) return installments[idx].amount;
  return Math.round((packageAmount / monthsCount) * 100) / 100;
}

/** Sum amounts collected per subscription in a calendar month. */
export function aggregateSubscriptionCollections(
  payments: { subscriptionId: string; amount: { toString(): string } }[]
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const p of payments) {
    const amount = decimalToNumber(p.amount);
    totals.set(p.subscriptionId, (totals.get(p.subscriptionId) ?? 0) + amount);
  }
  return totals;
}

type ServiceMonthPayment = Awaited<
  ReturnType<typeof fetchServiceMonthPayments>
>[number];

async function fetchServiceMonthPayments(employeeId: string, month: number, year: number) {
  return prisma.payment.findMany({
    where: {
      ...paymentsWithServiceMonthWhere(month, year),
      subscription: { client: { trainerId: employeeId } },
    },
    include: {
      subscription: { include: { client: true } },
    },
  });
}

function dedupeServiceMonthPayments(payments: ServiceMonthPayment[]): ServiceMonthPayment[] {
  const seen = new Map<string, ServiceMonthPayment>();
  for (const p of payments) {
    const key = `${p.subscriptionId}:${p.installmentIndex ?? 0}`;
    if (!seen.has(key)) {
      seen.set(key, p);
    }
  }
  return [...seen.values()];
}

export type TrainerMonthlyReport = {
  trainer: {
    id: string;
    name: string;
    baseSalary: number;
    monthlyTarget: number | null;
    activeSplitPercent: number;
    configuredSplitPercent: number;
    targetMet: boolean;
    hasTarget: boolean;
    flatSplitPeriod: boolean;
    ruleMode: string | null;
  };
  period: { month: number; year: number };
  rows: TrainerMonthlyReportRow[];
  summary: {
    totalPtRevenue: number;
    totalTrainerShare: number;
    baseSalary: number;
    grossPay: number;
    netPay: number;
    incentives: number;
    deductions: number;
    expenses: number;
    payrollGenerated: boolean;
    payrollStatus: string | null;
  };
};

function serializeReport(report: TrainerMonthlyReport): TrainerMonthlyReport {
  return JSON.parse(JSON.stringify(report)) as TrainerMonthlyReport;
}

export async function getTrainerMonthlyReport(
  employeeId: string,
  month: number,
  year: number
): Promise<TrainerMonthlyReport | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      user: true,
      payrollRuns: {
        where: { month, year },
        include: { lineItems: true },
      },
    },
  });

  if (!employee) return null;

  await recalculateTrainerMonthSplits(employeeId, month, year);

  const [servicePayments, collectedPayments, totalPtRevenue] = await Promise.all([
    fetchServiceMonthPayments(employeeId, month, year),
    prisma.payment.findMany({
      where: {
        ...paymentsCollectedInMonthWhere(month, year),
        subscription: { client: { trainerId: employeeId } },
      },
      select: { subscriptionId: true, amount: true },
    }),
    getTrainerMonthlyPtRevenue(employeeId, month, year),
  ]);

  const collectionBySubscription = aggregateSubscriptionCollections(collectedPayments);
  const dedupedPayments = dedupeServiceMonthPayments(servicePayments);

  dedupedPayments.sort((a, b) => {
    const nameCmp = a.subscription.client.name.localeCompare(b.subscription.client.name);
    if (nameCmp !== 0) return nameCmp;
    return a.paidAt.getTime() - b.paidAt.getTime();
  });

  const resolution = await resolveSplitForMonth(employeeId, month, year, totalPtRevenue);
  const splitStatus = getSplitStatusFromResolution(resolution);
  const configuredSplit = resolution.splitPercent;

  const rows: TrainerMonthlyReportRow[] = dedupedPayments.map((p) => {
    const sub = p.subscription;
    const packageAmount = decimalToNumber(sub.amount);
    const monthsCount = resolvePackageMonths(sub);
    const installmentIndex = p.installmentIndex;
    const collectedTotal = collectionBySubscription.get(p.subscriptionId);
    return {
      paymentId: p.id,
      clientId: sub.clientId,
      clientName: sub.client.name,
      subscriptionStart: sub.startDate,
      subscriptionEnd: sub.endDate,
      monthsCount,
      monthlyShare: resolveMonthlyShare(
        packageAmount,
        sub.startDate,
        monthsCount,
        installmentIndex
      ),
      amountPaidThisMonth:
        collectedTotal !== undefined && collectedTotal > 0 ? collectedTotal : null,
      trainerShare: decimalToNumber(p.trainerShareAmount),
      splitPercent: decimalToNumber(p.splitPercentUsed) || configuredSplit,
      serviceMonth: p.paidAt,
      paidOn: getPaymentCollectionDate(p),
      payableAt: p.payableAt,
      installmentIndex,
    };
  });

  const totalTrainerShare = rows.reduce((s, r) => s + r.trainerShare, 0);
  const baseSalary = decimalToNumber(employee.baseSalary);
  const payroll = employee.payrollRuns[0];

  const incentives = payroll ? decimalToNumber(payroll.incentives) : 0;
  const deductions = payroll ? decimalToNumber(payroll.deductions) : 0;
  const expenses = payroll ? decimalToNumber(payroll.expenses) : 0;
  const grossPay = payroll
    ? decimalToNumber(payroll.grossPay)
    : baseSalary + totalTrainerShare;
  const netPay = payroll
    ? decimalToNumber(payroll.netPay)
    : grossPay - deductions - expenses;

  return {
    trainer: {
      id: employee.id,
      name: employee.user.name,
      baseSalary,
      monthlyTarget: resolution.monthlyTarget,
      activeSplitPercent: configuredSplit,
      configuredSplitPercent: configuredSplit,
      targetMet: splitStatus.targetMet,
      hasTarget: splitStatus.hasTarget,
      flatSplitPeriod: splitStatus.flatSplitPeriod,
      ruleMode: resolution.mode,
    },
    period: { month, year },
    rows,
    summary: {
      totalPtRevenue,
      totalTrainerShare,
      baseSalary,
      grossPay,
      netPay,
      incentives,
      deductions,
      expenses,
      payrollGenerated: !!payroll,
      payrollStatus: payroll?.status ?? null,
    },
  };
}

export async function getGymMonthlyReports(gymId: string, month: number, year: number) {
  const trainers = await prisma.employee.findMany({
    where: { gymId, employeeType: "TRAINER" },
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });

  const reports = await Promise.all(
    trainers.map((t) => getTrainerMonthlyReport(t.id, month, year))
  );

  return reports.filter((r): r is TrainerMonthlyReport => r !== null);
}

export async function getTrainerMonthlyReportFromSnapshot(
  payrollRunId: string
): Promise<TrainerMonthlyReport | null> {
  const payroll = await prisma.payrollRun.findUnique({
    where: { id: payrollRunId },
    select: { reportSnapshot: true },
  });

  if (!payroll?.reportSnapshot) return null;
  return payroll.reportSnapshot as unknown as TrainerMonthlyReport;
}

export { serializeReport };
