import { prisma } from "@/lib/prisma";
import { decimalToNumber, formatDate } from "@/lib/utils";
import { getMonthName, getMonthYear } from "@/lib/permissions";
import { shiftMonth } from "@/lib/date-ymd";
import { GYM_START_MONTH, GYM_START_YEAR, isBeforeGymStart } from "@/lib/gym-calendar";
import { EXPENSE_CATEGORY_LABELS, NET_FORMULA_LABEL } from "@/lib/revenue-constants";
import {
  getRevenueMonthSummary,
  getRevenueTrend,
} from "@/lib/services/revenue-summary";
import { getTrainerDashboardStats, getTrainerOverview } from "@/lib/services/pt-tracker";
import { getExpenseDashboard } from "@/lib/services/expenses";
import {
  getMonthBounds,
  getPaymentCollectionDate,
  getTrainerMonthlyPtRevenue,
  paymentsCollectedInMonthWhere,
  resolveSplitForMonth,
} from "@/lib/services/trainer-split";
import { hasActivePt } from "@/lib/client-pt-status";

export type HomeAlert = {
  tone: "warning" | "info";
  text: string;
  href: string;
};

export type HomeKpi = {
  title: string;
  value: string;
  subtitle?: string;
  href?: string;
  deltaPct?: number | null;
  deltaInvert?: boolean;
  highlight?: boolean;
  tone?: "default" | "positive" | "negative" | "warning";
};

export type NamedAmount = { name: string; value: number };

export type TrendPoint = {
  label: string;
  cultIncome: number;
  ptRevenue: number;
  expenses: number;
  payrollPaid: number;
  grossIncome: number;
  totalCosts: number;
  netResult: number;
};

export type OwnerHomeOverview = {
  monthLabel: string;
  formula: string;
  kpis: HomeKpi[];
  alerts: HomeAlert[];
  trend: TrendPoint[];
  incomeMix: NamedAmount[];
  expenseMix: NamedAmount[];
  trainers: Array<{
    name: string;
    clients: number;
    ptRevenue: number;
    trainerShare: number;
    ownerShare: number;
    target: number | null;
    hasTarget: boolean;
    targetMet: boolean;
  }>;
  payroll: Array<{
    id: string;
    name: string;
    netPay: number;
    status: string;
  }>;
  renewals: Array<{
    id: string;
    clientName: string;
    trainerName: string;
    endDateLabel: string;
  }>;
  recentExpenses: Array<{
    id: string;
    dateLabel: string;
    category: string;
    description: string;
    amount: number;
  }>;
};

export type SupervisorHomeOverview = {
  monthLabel: string;
  kpis: HomeKpi[];
  alerts: HomeAlert[];
  ptByTrainer: Array<{ name: string; clients: number; ptRevenue: number }>;
  spendMix: NamedAmount[];
  spendTrend: Array<{ label: string; spent: number }>;
  payroll: Array<{
    id: string;
    name: string;
    netPay: number;
    status: string;
  }>;
  renewals: Array<{
    id: string;
    clientName: string;
    trainerName: string;
    endDateLabel: string;
  }>;
  recentSpends: Array<{
    id: string;
    dateLabel: string;
    category: string;
    description: string;
    amount: number;
  }>;
};

export type TrainerHomeOverview = {
  monthLabel: string;
  trainerName: string;
  kpis: HomeKpi[];
  alerts: HomeAlert[];
  target: {
    hasTarget: boolean;
    targetMet: boolean;
    monthlyTarget: number | null;
    ptRevenue: number;
    splitPercent: number;
  } | null;
  earningsTrend: Array<{ label: string; earnings: number; ptRevenue: number }>;
  clientMix: NamedAmount[];
  todaySchedule: Awaited<ReturnType<typeof getTrainerDashboardStats>>["todaySchedule"];
  expiringClients: Array<{ id: string; clientId: string; clientName: string }>;
  payroll: { status: string; netPay: number } | null;
};

function momPct(current: number, previous: number | undefined): number | null {
  if (previous == null) return null;
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfLocalDay(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function shortMonthLabel(month: number, year: number) {
  const name = new Date(2000, month - 1, 1).toLocaleString("en-IN", { month: "short" });
  return `${name} '${String(year).slice(2)}`;
}

function trendMonthsBack(month: number, year: number, count: number) {
  const keys: Array<{ month: number; year: number }> = [];
  let cursor = { month, year };
  for (let i = 0; i < count; i++) {
    if (isBeforeGymStart(cursor.month, cursor.year)) break;
    keys.unshift(cursor);
    cursor = shiftMonth(cursor.month, cursor.year, -1);
  }
  if (keys.length === 0) keys.push({ month: GYM_START_MONTH, year: GYM_START_YEAR });
  return keys;
}

async function getOperationalSnapshot(gymId: string) {
  const startToday = startOfLocalDay();
  const in7 = addDays(startToday, 7);
  const in30 = addDays(startToday, 30);

  const [trainerCount, totalClients, activePtClients, renewals7Count, renewals30Count, renewals] =
    await Promise.all([
      prisma.employee.count({ where: { gymId, employeeType: "TRAINER" } }),
      prisma.client.count({ where: { gymId } }),
      prisma.client.count({
        where: {
          gymId,
          subscriptions: {
            some: {
              status: { in: ["ACTIVE", "EXPIRING"] },
              endDate: { gte: startToday },
            },
          },
        },
      }),
      prisma.pTSubscription.count({
        where: {
          client: { gymId },
          status: { in: ["ACTIVE", "EXPIRING"] },
          endDate: { gte: startToday, lte: in7 },
        },
      }),
      prisma.pTSubscription.count({
        where: {
          client: { gymId },
          status: { in: ["ACTIVE", "EXPIRING"] },
          endDate: { gte: startToday, lte: in30 },
        },
      }),
      prisma.pTSubscription.findMany({
        where: {
          client: { gymId },
          status: { in: ["ACTIVE", "EXPIRING"] },
          endDate: { gte: startToday, lte: in7 },
        },
        include: { client: { include: { trainer: { include: { user: true } } } } },
        orderBy: { endDate: "asc" },
        take: 8,
      }),
    ]);

  return {
    trainerCount,
    totalClients,
    activePtClients,
    renewals7Count,
    renewals30Count,
    renewals: renewals.map((sub) => ({
      id: sub.id,
      clientName: sub.client.name,
      trainerName: sub.client.trainer.user.name,
      endDateLabel: formatDate(sub.endDate),
    })),
  };
}

function payrollRows(
  runs: Array<{
    id: string;
    netPay: { toString(): string } | number;
    status: string;
    employee: { user: { name: string } };
  }>
) {
  return runs.map((run) => ({
    id: run.id,
    name: run.employee.user.name,
    netPay: decimalToNumber(run.netPay),
    status: run.status,
  }));
}

export async function getOwnerHomeOverview(gymId: string): Promise<OwnerHomeOverview> {
  const { month, year } = getMonthYear();
  const monthLabel = `${getMonthName(month)} ${year}`;

  const [summary, trendRaw, trainers, ops, expenseDash, recentExpenses] = await Promise.all([
    getRevenueMonthSummary(gymId, month, year),
    getRevenueTrend(gymId, month, year),
    getTrainerOverview(gymId),
    getOperationalSnapshot(gymId),
    getExpenseDashboard(gymId, month, year),
    prisma.gymExpense.findMany({
      where: { gymId, kind: { in: ["OWNER_BILL", "SUPERVISOR_ADVANCE"] } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
  ]);

  const prev = trendRaw.length > 1 ? trendRaw[trendRaw.length - 2] : undefined;
  const cultEntered = summary.partnerShare != null;
  const pendingPayroll = summary.payrollRuns.filter((run) => run.status !== "PAID").length;

  const alerts: HomeAlert[] = [];
  if (!cultEntered) {
    alerts.push({
      tone: "warning",
      text: `Received from Cult is not entered for ${monthLabel}`,
      href: "/owner/revenue",
    });
  }
  if (pendingPayroll > 0) {
    alerts.push({
      tone: "warning",
      text: `${pendingPayroll} payroll ${pendingPayroll === 1 ? "run is" : "runs are"} still unpaid`,
      href: "/owner/salaries",
    });
  }
  if (ops.renewals7Count > 0) {
    alerts.push({
      tone: "info",
      text: `${ops.renewals7Count} PT ${ops.renewals7Count === 1 ? "pack" : "packs"} renew in the next 7 days`,
      href: "/owner/renewals",
    });
  }
  if (expenseDash.pettyRemaining < 0) {
    alerts.push({
      tone: "warning",
      text: "Supervisor petty cash is overdrawn",
      href: "/owner/expenses",
    });
  }

  const kpis: HomeKpi[] = [
    {
      title: "Net result",
      value: formatInr(summary.netResult),
      subtitle: monthLabel,
      href: "/owner/revenue",
      deltaPct: momPct(summary.netResult, prev?.netResult),
      highlight: true,
      tone: summary.netResult >= 0 ? "positive" : "negative",
    },
    {
      title: "Gross income",
      value: formatInr(summary.grossIncome),
      subtitle: "Cult after TDS + Total PT",
      href: "/owner/revenue",
      deltaPct: momPct(summary.grossIncome, prev?.grossIncome),
    },
    {
      title: "Costs",
      value: formatInr(summary.totalCosts),
      subtitle: `Bills ${formatInr(summary.manualExpenses)} · Pay ${formatInr(summary.payrollPaid)}`,
      href: "/owner/expenses",
      deltaPct: momPct(summary.totalCosts, prev?.totalCosts),
      deltaInvert: true,
    },
    {
      title: "Total PT",
      value: formatInr(summary.ptRevenue),
      subtitle: `Owner ${formatInr(summary.ownerPtShare)} · Trainer ${formatInr(summary.trainerPtShare)}`,
      href: "/owner/reports",
      deltaPct: momPct(summary.ptRevenue, prev?.ptRevenue),
    },
    {
      title: "Active PT clients",
      value: String(ops.activePtClients),
      subtitle: `${ops.totalClients} clients · ${ops.trainerCount} trainers`,
      href: "/owner/clients",
    },
    {
      title: "Renewals (7 days)",
      value: String(ops.renewals7Count),
      subtitle: `${ops.renewals30Count} due in 30 days`,
      href: "/owner/renewals",
      tone: ops.renewals7Count > 0 ? "warning" : "default",
    },
    {
      title: "Payroll pending",
      value: formatInr(summary.payrollPending),
      subtitle:
        summary.payrollRuns.length === 0
          ? "Not generated this month"
          : `${pendingPayroll} unpaid · ${summary.payrollRuns.length - pendingPayroll} paid`,
      href: "/owner/salaries",
      tone: summary.payrollPending > 0 ? "warning" : "default",
    },
    {
      title: "Petty cash left",
      value: formatInr(expenseDash.pettyRemaining),
      subtitle: `Issued ${formatInr(expenseDash.pettyIssuedAll)} · Spent ${formatInr(expenseDash.pettySpentAll)}`,
      href: "/owner/expenses",
      tone: expenseDash.pettyRemaining < 0 ? "negative" : "default",
    },
  ];

  return {
    monthLabel,
    formula: NET_FORMULA_LABEL,
    kpis,
    alerts,
    trend: trendRaw.map((row) => ({
      label: shortMonthLabel(row.month, row.year),
      cultIncome: row.cultIncome,
      ptRevenue: row.ptRevenue,
      expenses: row.manualExpenses,
      payrollPaid: row.payrollPaid,
      grossIncome: row.grossIncome,
      totalCosts: row.totalCosts,
      netResult: row.netResult,
    })),
    incomeMix: [
      { name: "Cult after TDS", value: summary.cultIncome },
      { name: "Total PT", value: summary.ptRevenue },
    ].filter((row) => row.value > 0),
    expenseMix: [
      ...summary.expensesByCategory.map((row) => ({ name: row.label, value: row.amount })),
      ...(summary.payrollPaid > 0 ? [{ name: "Payroll (paid)", value: summary.payrollPaid }] : []),
    ].filter((row) => row.value > 0),
    trainers: trainers.map((trainer) => ({
      name: trainer.name,
      clients: trainer.clientCount,
      ptRevenue: trainer.monthlyRevenue,
      trainerShare: trainer.trainerShare,
      ownerShare: trainer.ownerShare,
      target: trainer.monthlyTarget,
      hasTarget: trainer.hasTarget,
      targetMet: trainer.targetMet,
    })),
    payroll: summary.payrollRuns.map((run) => ({
      id: run.id,
      name: run.employeeName,
      netPay: run.netPay,
      status: run.status,
    })),
    renewals: ops.renewals,
    recentExpenses: recentExpenses.map((row) => ({
      id: row.id,
      dateLabel: formatDate(row.date),
      category: EXPENSE_CATEGORY_LABELS[row.category],
      description: row.description,
      amount: decimalToNumber(row.amount),
    })),
  };
}

export async function getSupervisorHomeOverview(gymId: string): Promise<SupervisorHomeOverview> {
  const { month, year } = getMonthYear();
  const monthLabel = `${getMonthName(month)} ${year}`;

  const [trainers, ops, expenseDash, payrollRuns, recentSpends, ptPayments] = await Promise.all([
    getTrainerOverview(gymId),
    getOperationalSnapshot(gymId),
    getExpenseDashboard(gymId, month, year),
    prisma.payrollRun.findMany({
      where: { month, year, employee: { gymId } },
      include: { employee: { include: { user: true } } },
      orderBy: { employee: { user: { name: "asc" } } },
    }),
    prisma.gymExpense.findMany({
      where: { gymId, kind: "SUPERVISOR_SPEND" },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
    prisma.payment.findMany({
      where: {
        ...paymentsCollectedInMonthWhere(month, year),
        subscription: { client: { gymId } },
      },
      select: { amount: true },
    }),
  ]);

  const ptRevenue = ptPayments.reduce((sum, payment) => sum + decimalToNumber(payment.amount), 0);
  const payroll = payrollRows(payrollRuns);
  const pendingPayroll = payroll.filter((run) => run.status !== "PAID").length;
  const petty = {
    remaining: expenseDash.pettyRemaining,
    issued: expenseDash.pettyIssuedAll,
    spent: expenseDash.pettySpentAll,
    spentMonth: expenseDash.pettySpentMonth,
    issuedMonth: expenseDash.pettyIssuedMonth,
  };

  const alerts: HomeAlert[] = [];
  if (petty.remaining < 0) {
    alerts.push({
      tone: "warning",
      text: "Petty cash is overdrawn — ask the owner for a top-up",
      href: "/supervisor/expenses",
    });
  } else if (petty.remaining > 0 && petty.remaining < 2000) {
    alerts.push({
      tone: "info",
      text: `Petty cash remaining is ${formatInr(petty.remaining)}`,
      href: "/supervisor/expenses",
    });
  }
  if (ops.renewals7Count > 0) {
    alerts.push({
      tone: "info",
      text: `${ops.renewals7Count} PT ${ops.renewals7Count === 1 ? "pack" : "packs"} renew in the next 7 days`,
      href: "/supervisor/renewals",
    });
  }
  if (pendingPayroll > 0) {
    alerts.push({
      tone: "warning",
      text: `${pendingPayroll} payroll ${pendingPayroll === 1 ? "run is" : "runs are"} still unpaid`,
      href: "/supervisor/salaries",
    });
  }

  const kpis: HomeKpi[] = [
    {
      title: "Active PT clients",
      value: String(ops.activePtClients),
      subtitle: `${ops.totalClients} clients · ${ops.trainerCount} trainers`,
      href: "/supervisor/clients",
    },
    {
      title: "PT collected (MTD)",
      value: formatInr(ptRevenue),
      subtitle: monthLabel,
      href: "/supervisor/reports",
    },
    {
      title: "Renewals (7 days)",
      value: String(ops.renewals7Count),
      subtitle: `${ops.renewals30Count} due in 30 days`,
      href: "/supervisor/renewals",
      tone: ops.renewals7Count > 0 ? "warning" : "default",
    },
    {
      title: "Petty cash left",
      value: formatInr(petty.remaining),
      subtitle: `Issued ${formatInr(petty.issued)} · Spent ${formatInr(petty.spent)}`,
      href: "/supervisor/expenses",
      highlight: true,
      tone: petty.remaining < 0 ? "negative" : petty.remaining === 0 ? "default" : "positive",
    },
    {
      title: "Spent this month",
      value: formatInr(petty.spentMonth),
      subtitle: expenseDash.spendByCategory[0]
        ? `Top: ${expenseDash.spendByCategory[0].label}`
        : "From cash given by owner",
      href: "/supervisor/expenses",
    },
    {
      title: "Cash received (MTD)",
      value: formatInr(petty.issuedMonth),
      subtitle: "Owner advances this month",
      href: "/supervisor/expenses",
    },
    {
      title: "Payroll unpaid",
      value: String(pendingPayroll),
      subtitle:
        payroll.length === 0 ? "Not generated this month" : `${payroll.length} runs this month`,
      href: "/supervisor/salaries",
      tone: pendingPayroll > 0 ? "warning" : "default",
    },
    {
      title: "Trainers",
      value: String(ops.trainerCount),
      subtitle: "Active team",
      href: "/supervisor/trainers",
    },
  ];

  return {
    monthLabel,
    kpis,
    alerts,
    ptByTrainer: trainers.map((trainer) => ({
      name: trainer.name,
      clients: trainer.clientCount,
      ptRevenue: trainer.monthlyRevenue,
    })),
    spendMix: expenseDash.spendByCategory.map((row) => ({ name: row.label, value: row.amount })),
    spendTrend: expenseDash.trend
      .filter((row) => !isBeforeGymStart(row.month, row.year))
      .map((row) => ({
        label: shortMonthLabel(row.month, row.year),
        spent: row.spendTotal,
      })),
    payroll,
    renewals: ops.renewals,
    recentSpends: recentSpends.map((row) => ({
      id: row.id,
      dateLabel: formatDate(row.date),
      category: EXPENSE_CATEGORY_LABELS[row.category],
      description: row.description,
      amount: decimalToNumber(row.amount),
    })),
  };
}

export async function getTrainerHomeOverview(employeeId: string): Promise<TrainerHomeOverview | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: true },
  });
  if (!employee) return null;

  const { month, year } = getMonthYear();
  const monthLabel = `${getMonthName(month)} ${year}`;
  const keys = trendMonthsBack(month, year, 6);
  const rangeStart = getMonthBounds(keys[0].month, keys[0].year).start;
  const rangeEnd = getMonthBounds(keys[keys.length - 1].month, keys[keys.length - 1].year).end;

  const [stats, clients, payments, payroll, monthPt] = await Promise.all([
    getTrainerDashboardStats(employeeId),
    prisma.client.findMany({
      where: { trainerId: employeeId },
      include: { subscriptions: { orderBy: { endDate: "desc" }, take: 1 } },
    }),
    prisma.payment.findMany({
      where: {
        subscription: { client: { trainerId: employeeId } },
        OR: [
          { collectedAt: { gte: rangeStart, lte: rangeEnd } },
          { collectedAt: null, paidAt: { gte: rangeStart, lte: rangeEnd } },
        ],
      },
      select: { amount: true, trainerShareAmount: true, collectedAt: true, paidAt: true },
    }),
    prisma.payrollRun.findFirst({
      where: { employeeId, month, year },
    }),
    getTrainerMonthlyPtRevenue(employeeId, month, year),
  ]);
  const split = await resolveSplitForMonth(employeeId, month, year, monthPt);

  const buckets = new Map(keys.map((key) => [`${key.year}-${key.month}`, { earnings: 0, ptRevenue: 0 }]));
  for (const payment of payments) {
    const collected = getPaymentCollectionDate(payment);
    const key = `${collected.getFullYear()}-${collected.getMonth() + 1}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.earnings += decimalToNumber(payment.trainerShareAmount);
    bucket.ptRevenue += decimalToNumber(payment.amount);
  }

  const now = new Date();
  let active = 0;
  let expiring = 0;
  let expired = 0;
  const in7 = addDays(startOfLocalDay(now), 7);
  for (const client of clients) {
    const end = client.subscriptions[0]?.endDate;
    if (!end) {
      expired += 1;
      continue;
    }
    if (!hasActivePt(end, now)) {
      expired += 1;
      continue;
    }
    if (end <= in7) expiring += 1;
    else active += 1;
  }

  const scheduledCount = stats.todaySchedule.filter((row) => row.hasSlot).length;
  const unscheduledCount = stats.todaySchedule.length - scheduledCount;

  const alerts: HomeAlert[] = [];
  if (unscheduledCount > 0) {
    alerts.push({
      tone: "info",
      text: `${unscheduledCount} active ${unscheduledCount === 1 ? "client has" : "clients have"} no time slot today`,
      href: "/trainer/schedule",
    });
  }
  if (stats.expiringClients.length > 0) {
    alerts.push({
      tone: "warning",
      text: `${stats.expiringClients.length} ${stats.expiringClients.length === 1 ? "client needs" : "clients need"} renewal this week`,
      href: "/trainer/clients",
    });
  }

  const kpis: HomeKpi[] = [
    {
      title: "Active clients",
      value: String(stats.clientCount),
      subtitle: `${clients.length} total on your roster`,
      href: "/trainer/clients",
    },
    {
      title: "Scheduled today",
      value: String(scheduledCount),
      subtitle: unscheduledCount > 0 ? `${unscheduledCount} still open` : "All active clients slotted",
      href: "/trainer/schedule",
    },
    {
      title: "Open slots",
      value: String(stats.openSlots),
      subtitle: "Upcoming empty slots",
      href: "/trainer/schedule",
    },
    {
      title: "Your share (MTD)",
      value: formatInr(stats.monthlyEarnings),
      subtitle: `PT collected ${formatInr(monthPt)}`,
      href: "/trainer/earnings",
      highlight: true,
    },
  ];

  return {
    monthLabel,
    trainerName: employee.user.name,
    kpis,
    alerts,
    target: {
      hasTarget: split.hasTarget,
      targetMet: split.targetMet,
      monthlyTarget: split.monthlyTarget,
      ptRevenue: monthPt,
      splitPercent: split.splitPercent,
    },
    earningsTrend: keys.map((key) => {
      const bucket = buckets.get(`${key.year}-${key.month}`) ?? { earnings: 0, ptRevenue: 0 };
      return {
        label: shortMonthLabel(key.month, key.year),
        earnings: bucket.earnings,
        ptRevenue: bucket.ptRevenue,
      };
    }),
    clientMix: [
      { name: "Active", value: active },
      { name: "Renewing soon", value: expiring },
      { name: "Expired", value: expired },
    ].filter((row) => row.value > 0),
    todaySchedule: stats.todaySchedule,
    expiringClients: stats.expiringClients.map((sub) => ({
      id: sub.id,
      clientId: sub.clientId,
      clientName: sub.client.name,
    })),
    payroll: payroll
      ? { status: payroll.status, netPay: decimalToNumber(payroll.netPay) }
      : null,
  };
}

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
