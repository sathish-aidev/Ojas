import { prisma } from "@/lib/prisma";
import { decimalToNumber, formatDate } from "@/lib/utils";
import { getMonthName } from "@/lib/permissions";
import { shiftMonth, startOfTodayInTimeZone } from "@/lib/date-ymd";
import {
  BOOKS_CLOSE_DAY,
  formatCloseByLabel,
  formatMonthYear,
  getGymToday,
  GYM_START_MONTH,
  GYM_START_YEAR,
  isBeforeGymStart,
  isBooksOverdue,
  lastCompletableMonth,
  maxYearMonth,
  monthOrdinal,
  pickClosedBooksMonth,
  type YearMonth,
} from "@/lib/gym-calendar";
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

export type CompareRow = {
  label: string;
  books: number;
  prior: number | null;
};

export type YtdTotals = {
  year: number;
  throughLabel: string;
  grossIncome: number;
  totalCosts: number;
  netResult: number;
  ptRevenue: number;
};

export type OwnerHomeOverview = {
  booksLabel: string;
  calendarLabel: string;
  ptMonthLabel: string;
  formula: string;
  subtitle: string;
  booksHref: string;
  closedKpis: HomeKpi[];
  liveKpis: HomeKpi[];
  alerts: HomeAlert[];
  compare: { booksLabel: string; priorLabel: string; rows: CompareRow[] } | null;
  ytd: YtdTotals;
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
  payrollLabel: string;
  renewals: Array<{
    id: string;
    clientId: string;
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
  booksLabel: string;
  calendarLabel: string;
  ptMonthLabel: string;
  spendMonthLabel: string;
  subtitle: string;
  reportsHref: string;
  salariesHref: string;
  expensesHref: string;
  closedKpis: HomeKpi[];
  liveKpis: HomeKpi[];
  alerts: HomeAlert[];
  compare: { booksLabel: string; priorLabel: string; rows: CompareRow[] } | null;
  ptByTrainer: Array<{ name: string; clients: number; ptRevenue: number }>;
  spendMix: NamedAmount[];
  spendTrend: Array<{ label: string; spent: number }>;
  payroll: Array<{
    id: string;
    name: string;
    netPay: number;
    status: string;
  }>;
  payrollLabel: string;
  renewals: Array<{
    id: string;
    clientId: string;
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
  booksLabel: string;
  calendarLabel: string;
  trainerName: string;
  kpis: HomeKpi[];
  alerts: HomeAlert[];
  target: {
    hasTarget: boolean;
    targetMet: boolean;
    monthlyTarget: number | null;
    ptRevenue: number;
    splitPercent: number;
    label: string;
  } | null;
  earningsTrend: Array<{ label: string; earnings: number; ptRevenue: number }>;
  clientMix: NamedAmount[];
  todaySchedule: Awaited<ReturnType<typeof getTrainerDashboardStats>>["todaySchedule"];
  expiringClients: Array<{ id: string; clientId: string; clientName: string }>;
  payroll: { status: string; netPay: number; monthLabel: string } | null;
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

function startOfGymDay() {
  return startOfTodayInTimeZone("Asia/Kolkata");
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

function sameMonth(a: YearMonth, b: YearMonth) {
  return a.month === b.month && a.year === b.year;
}

function monthHref(path: string, month: number, year: number) {
  return `${path}?month=${month}&year=${year}`;
}

async function resolveHomePeriod(gymId: string) {
  const today = getGymToday();
  const calendar = { month: today.month, year: today.year };
  const previous = lastCompletableMonth(calendar);

  const [latestCult, latestExpense, latestPayment] = await Promise.all([
    prisma.cultSettlement.findFirst({
      where: { gymId, partnerShare: { not: null } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { month: true, year: true },
    }),
    prisma.gymExpense.findFirst({
      where: { gymId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { month: true, year: true },
    }),
    prisma.payment.findFirst({
      where: { subscription: { client: { gymId } } },
      orderBy: [{ collectedAt: "desc" }, { paidAt: "desc" }],
      select: { collectedAt: true, paidAt: true },
    }),
  ]);

  const paymentMonth = latestPayment
    ? (() => {
        const collected = getGymToday(getPaymentCollectionDate(latestPayment));
        return { month: collected.month, year: collected.year };
      })()
    : null;

  const { books, due } = pickClosedBooksMonth({
    today: calendar,
    latestCult,
    latestActivity: maxYearMonth(latestExpense, paymentMonth),
  });

  return { today, calendar, previous, books, due };
}

function booksSubtitle(
  booksLabel: string,
  calendarLabel: string,
  due: YearMonth | null
) {
  if (due) {
    return `Showing ${booksLabel} (last closed books). ${formatMonthYear(due.month, due.year)} is usually entered by ${formatCloseByLabel(due)}.`;
  }
  return `${booksLabel} closed books. ${calendarLabel} is still in progress — full figures land around the ${BOOKS_CLOSE_DAY}th.`;
}

async function getOperationalSnapshot(gymId: string) {
  const startToday = startOfGymDay();
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
      clientId: sub.client.id,
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

function mapTrend(rows: Awaited<ReturnType<typeof getRevenueTrend>>): TrendPoint[] {
  return rows.map((row) => ({
    label: shortMonthLabel(row.month, row.year),
    cultIncome: row.cultIncome,
    ptRevenue: row.ptRevenue,
    expenses: row.manualExpenses,
    payrollPaid: row.payrollPaid,
    grossIncome: row.grossIncome,
    totalCosts: row.totalCosts,
    netResult: row.netResult,
  }));
}

function pickPtMonth(
  previous: YearMonth,
  books: YearMonth,
  trend: Awaited<ReturnType<typeof getRevenueTrend>>
) {
  const previousRow = trend.find((row) => row.month === previous.month && row.year === previous.year);
  if (previousRow && previousRow.ptRevenue > 0) return previous;
  return books;
}

function ytdFromTrend(
  trend: Awaited<ReturnType<typeof getRevenueTrend>>,
  books: YearMonth
): YtdTotals {
  const rows = trend.filter(
    (row) => row.year === books.year && monthOrdinal(row.month, row.year) <= monthOrdinal(books.month, books.year)
  );
  return {
    year: books.year,
    throughLabel: getMonthName(books.month),
    grossIncome: rows.reduce((sum, row) => sum + row.grossIncome, 0),
    totalCosts: rows.reduce((sum, row) => sum + row.totalCosts, 0),
    netResult: rows.reduce((sum, row) => sum + row.netResult, 0),
    ptRevenue: rows.reduce((sum, row) => sum + row.ptRevenue, 0),
  };
}

export async function getOwnerHomeOverview(gymId: string): Promise<OwnerHomeOverview> {
  const period = await resolveHomePeriod(gymId);
  const { today, calendar, previous, books, due } = period;
  const booksLabel = formatMonthYear(books.month, books.year);
  const calendarLabel = formatMonthYear(calendar.month, calendar.year);
  const booksHref = monthHref("/owner/revenue", books.month, books.year);

  const [summary, trendRaw, ops, expenseDash, recentExpenses, calendarPtPayments] = await Promise.all([
    getRevenueMonthSummary(gymId, books.month, books.year),
    getRevenueTrend(gymId, previous.month, previous.year),
    getOperationalSnapshot(gymId),
    getExpenseDashboard(gymId, calendar.month, calendar.year),
    prisma.gymExpense.findMany({
      where: { gymId, kind: { in: ["OWNER_BILL", "SUPERVISOR_ADVANCE"] } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
    prisma.payment.findMany({
      where: {
        ...paymentsCollectedInMonthWhere(calendar.month, calendar.year),
        subscription: { client: { gymId } },
      },
      select: { amount: true },
    }),
  ]);

  const ptMonth = pickPtMonth(previous, books, trendRaw);
  const trainers = await getTrainerOverview(gymId, ptMonth);
  const ptMonthLabel = formatMonthYear(ptMonth.month, ptMonth.year);

  const booksTrend = trendRaw.filter(
    (row) => monthOrdinal(row.month, row.year) <= monthOrdinal(books.month, books.year)
  );
  const prev = booksTrend.length > 1 ? booksTrend[booksTrend.length - 2] : undefined;
  const pendingPayroll = summary.payrollRuns.filter((run) => run.status !== "PAID").length;
  const calendarPt = calendarPtPayments.reduce((sum, payment) => sum + decimalToNumber(payment.amount), 0);

  const alerts: HomeAlert[] = [];
  if (due) {
    const dueLabel = formatMonthYear(due.month, due.year);
    const overdue = isBooksOverdue(today, due);
    alerts.push({
      tone: "warning",
      text: overdue
        ? `${dueLabel} books are past the usual ${formatCloseByLabel(due)} entry. Home is still showing ${booksLabel}.`
        : `${dueLabel} income and expenses are usually entered by ${formatCloseByLabel(due)}. Home is showing ${booksLabel} until then.`,
      href: monthHref("/owner/revenue", due.month, due.year),
    });
  }
  if (pendingPayroll > 0) {
    alerts.push({
      tone: "warning",
      text: `${pendingPayroll} payroll ${pendingPayroll === 1 ? "run is" : "runs are"} still unpaid for ${booksLabel}`,
      href: monthHref("/owner/salaries", books.month, books.year),
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

  const closedKpis: HomeKpi[] = [
    {
      title: "Net result",
      value: formatInr(summary.netResult),
      subtitle: booksLabel,
      href: booksHref,
      deltaPct: momPct(summary.netResult, prev?.netResult),
      highlight: true,
      tone: summary.netResult >= 0 ? "positive" : "negative",
    },
    {
      title: "Gross income",
      value: formatInr(summary.grossIncome),
      subtitle: "Cult after TDS + Total PT",
      href: booksHref,
      deltaPct: momPct(summary.grossIncome, prev?.grossIncome),
    },
    {
      title: "Costs",
      value: formatInr(summary.totalCosts),
      subtitle: `Bills ${formatInr(summary.manualExpenses)} · Pay ${formatInr(summary.payrollPaid)}`,
      href: monthHref("/owner/expenses", books.month, books.year),
      deltaPct: momPct(summary.totalCosts, prev?.totalCosts),
      deltaInvert: true,
    },
    {
      title: "Total PT",
      value: formatInr(summary.ptRevenue),
      subtitle: `Owner ${formatInr(summary.ownerPtShare)} · Trainer ${formatInr(summary.trainerPtShare)}`,
      href: monthHref("/owner/reports", books.month, books.year),
      deltaPct: momPct(summary.ptRevenue, prev?.ptRevenue),
    },
  ];

  const liveKpis: HomeKpi[] = [
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
      title: "PT this month so far",
      value: formatInr(calendarPt),
      subtitle: `${calendarLabel} collections`,
      href: monthHref("/owner/reports", calendar.month, calendar.year),
    },
    {
      title: "Petty cash left",
      value: formatInr(expenseDash.pettyRemaining),
      subtitle: `Issued ${formatInr(expenseDash.pettyIssuedAll)} · Spent ${formatInr(expenseDash.pettySpentAll)}`,
      href: "/owner/expenses",
      tone: expenseDash.pettyRemaining < 0 ? "negative" : "default",
    },
  ];

  const priorKey = shiftMonth(books.month, books.year, -1);
  const priorRow =
    !isBeforeGymStart(priorKey.month, priorKey.year)
      ? booksTrend.find((row) => row.month === priorKey.month && row.year === priorKey.year)
      : undefined;
  const compare = priorRow
    ? {
        booksLabel,
        priorLabel: formatMonthYear(priorRow.month, priorRow.year),
        rows: [
          { label: "Cult after TDS", books: summary.cultIncome, prior: priorRow.cultIncome },
          { label: "Total PT", books: summary.ptRevenue, prior: priorRow.ptRevenue },
          { label: "Gross income", books: summary.grossIncome, prior: priorRow.grossIncome },
          { label: "Gym bills", books: summary.manualExpenses, prior: priorRow.manualExpenses },
          { label: "Payroll paid", books: summary.payrollPaid, prior: priorRow.payrollPaid },
          { label: "Net result", books: summary.netResult, prior: priorRow.netResult },
        ],
      }
    : null;

  return {
    booksLabel,
    calendarLabel,
    ptMonthLabel,
    formula: NET_FORMULA_LABEL,
    subtitle: booksSubtitle(booksLabel, calendarLabel, due),
    booksHref,
    closedKpis,
    liveKpis,
    alerts,
    compare,
    ytd: ytdFromTrend(booksTrend, books),
    trend: mapTrend(booksTrend),
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
    payrollLabel: booksLabel,
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
  const period = await resolveHomePeriod(gymId);
  const { today, calendar, previous, books, due } = period;
  const booksLabel = formatMonthYear(books.month, books.year);
  const calendarLabel = formatMonthYear(calendar.month, calendar.year);

  const [ops, liveExpenses, booksExpenses, payrollRuns, recentSpends, trendRaw] = await Promise.all([
    getOperationalSnapshot(gymId),
    getExpenseDashboard(gymId, calendar.month, calendar.year),
    getExpenseDashboard(gymId, books.month, books.year),
    prisma.payrollRun.findMany({
      where: { month: books.month, year: books.year, employee: { gymId } },
      include: { employee: { include: { user: true } } },
      orderBy: { employee: { user: { name: "asc" } } },
    }),
    prisma.gymExpense.findMany({
      where: { gymId, kind: "SUPERVISOR_SPEND" },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 6,
    }),
    getRevenueTrend(gymId, previous.month, previous.year),
  ]);

  const ptMonth = pickPtMonth(previous, books, trendRaw);
  const trainers = await getTrainerOverview(gymId, ptMonth);
  const ptMonthLabel = formatMonthYear(ptMonth.month, ptMonth.year);

  let spendMonth = books;
  let spendMix = booksExpenses.spendByCategory.map((row) => ({ name: row.label, value: row.amount }));
  if (spendMix.length === 0) {
    const lastSpend = [...liveExpenses.trend].reverse().find((row) => row.spendTotal > 0);
    if (lastSpend) {
      spendMonth = { month: lastSpend.month, year: lastSpend.year };
      if (!sameMonth(spendMonth, books)) {
        const spendDash = await getExpenseDashboard(gymId, spendMonth.month, spendMonth.year);
        spendMix = spendDash.spendByCategory.map((row) => ({ name: row.label, value: row.amount }));
      }
    }
  }
  const spendMonthLabel = formatMonthYear(spendMonth.month, spendMonth.year);
  const spendTotal = spendMix.reduce((sum, row) => sum + row.value, 0);

  const payroll = payrollRows(payrollRuns);
  const pendingPayroll = payroll.filter((run) => run.status !== "PAID").length;
  const ptRevenue = trainers.reduce((sum, trainer) => sum + trainer.monthlyRevenue, 0);
  const reportsHref = monthHref("/supervisor/reports", ptMonth.month, ptMonth.year);
  const salariesHref = monthHref("/supervisor/salaries", books.month, books.year);
  const expensesHref = monthHref("/supervisor/expenses", spendMonth.month, spendMonth.year);
  const liveExpensesHref = monthHref("/supervisor/expenses", calendar.month, calendar.year);

  const priorBooksKey = shiftMonth(books.month, books.year, -1);
  const booksPt =
    trendRaw.find((row) => row.month === books.month && row.year === books.year)?.ptRevenue ?? ptRevenue;
  const priorPt = isBeforeGymStart(priorBooksKey.month, priorBooksKey.year)
    ? undefined
    : trendRaw.find((row) => row.month === priorBooksKey.month && row.year === priorBooksKey.year)?.ptRevenue;
  const booksSpend =
    liveExpenses.trend.find((row) => row.month === books.month && row.year === books.year)?.spendTotal ?? 0;
  const priorSpend = isBeforeGymStart(priorBooksKey.month, priorBooksKey.year)
    ? undefined
    : liveExpenses.trend.find((row) => row.month === priorBooksKey.month && row.year === priorBooksKey.year)
        ?.spendTotal;
  const compare = !isBeforeGymStart(priorBooksKey.month, priorBooksKey.year)
    ? {
        booksLabel,
        priorLabel: formatMonthYear(priorBooksKey.month, priorBooksKey.year),
        rows: [
          { label: "PT collected", books: booksPt, prior: priorPt ?? null },
          { label: "Supervisor spend", books: booksSpend, prior: priorSpend ?? null },
        ],
      }
    : null;

  const alerts: HomeAlert[] = [];
  if (due) {
    const dueLabel = formatMonthYear(due.month, due.year);
    alerts.push({
      tone: isBooksOverdue(today, due) ? "warning" : "info",
      text: isBooksOverdue(today, due)
        ? `${dueLabel} spends are past the usual ${formatCloseByLabel(due)} entry.`
        : `${dueLabel} spends are usually entered by ${formatCloseByLabel(due)}.`,
      href: monthHref("/supervisor/expenses", due.month, due.year),
    });
  }
  if (liveExpenses.pettyRemaining < 0) {
    alerts.push({
      tone: "warning",
      text: "Petty cash is overdrawn — ask the owner for a top-up",
      href: liveExpensesHref,
    });
  } else if (liveExpenses.pettyRemaining > 0 && liveExpenses.pettyRemaining < 2000) {
    alerts.push({
      tone: "info",
      text: `Petty cash remaining is ${formatInr(liveExpenses.pettyRemaining)}`,
      href: liveExpensesHref,
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
      text: `${pendingPayroll} payroll ${pendingPayroll === 1 ? "run is" : "runs are"} still unpaid for ${booksLabel}`,
      href: salariesHref,
    });
  } else if (payroll.length === 0) {
    alerts.push({
      tone: "info",
      text: `Payroll is not generated yet for ${booksLabel}`,
      href: salariesHref,
    });
  }

  const liveKpis: HomeKpi[] = [
    {
      title: "Active PT clients",
      value: String(ops.activePtClients),
      subtitle: `${ops.totalClients} clients · ${ops.trainerCount} trainers`,
      href: "/supervisor/clients",
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
      value: formatInr(liveExpenses.pettyRemaining),
      subtitle: `Issued ${formatInr(liveExpenses.pettyIssuedAll)} · Spent ${formatInr(liveExpenses.pettySpentAll)}`,
      href: liveExpensesHref,
      highlight: true,
      tone: liveExpenses.pettyRemaining < 0 ? "negative" : liveExpenses.pettyRemaining === 0 ? "default" : "positive",
    },
    {
      title: "Spent this month so far",
      value: formatInr(liveExpenses.pettySpentMonth),
      subtitle: calendarLabel,
      href: liveExpensesHref,
    },
  ];

  const priorPtKpiKey = shiftMonth(ptMonth.month, ptMonth.year, -1);
  const priorSpendKpiKey = shiftMonth(spendMonth.month, spendMonth.year, -1);
  const priorPtKpi = isBeforeGymStart(priorPtKpiKey.month, priorPtKpiKey.year)
    ? undefined
    : trendRaw.find((row) => row.month === priorPtKpiKey.month && row.year === priorPtKpiKey.year)?.ptRevenue;
  const priorSpendKpi = isBeforeGymStart(priorSpendKpiKey.month, priorSpendKpiKey.year)
    ? undefined
    : liveExpenses.trend.find(
        (row) => row.month === priorSpendKpiKey.month && row.year === priorSpendKpiKey.year
      )?.spendTotal;

  const closedKpis: HomeKpi[] = [
    {
      title: "PT collected",
      value: formatInr(ptRevenue),
      subtitle: ptMonthLabel,
      href: reportsHref,
      deltaPct: momPct(ptRevenue, priorPtKpi),
    },
    {
      title: "Supervisor spend",
      value: formatInr(spendTotal),
      subtitle: spendMonthLabel,
      href: expensesHref,
      deltaPct: momPct(spendTotal, priorSpendKpi),
      deltaInvert: true,
    },
    {
      title: "Payroll unpaid",
      value: String(pendingPayroll),
      subtitle: payroll.length === 0 ? `Not generated for ${booksLabel}` : `${payroll.length} runs · ${booksLabel}`,
      href: salariesHref,
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
    booksLabel,
    calendarLabel,
    ptMonthLabel,
    spendMonthLabel,
    subtitle: booksSubtitle(booksLabel, calendarLabel, due),
    reportsHref,
    salariesHref,
    expensesHref,
    closedKpis,
    liveKpis,
    alerts,
    compare,
    ptByTrainer: trainers.map((trainer) => ({
      name: trainer.name,
      clients: trainer.clientCount,
      ptRevenue: trainer.monthlyRevenue,
    })),
    spendMix,
    spendTrend: liveExpenses.trend
      .filter((row) => !isBeforeGymStart(row.month, row.year))
      .map((row) => ({
        label: shortMonthLabel(row.month, row.year),
        spent: row.spendTotal,
      })),
    payroll,
    payrollLabel: booksLabel,
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

  const today = getGymToday();
  const calendar = { month: today.month, year: today.year };
  const previous = lastCompletableMonth(calendar);
  const calendarLabel = formatMonthYear(calendar.month, calendar.year);
  const booksLabel = formatMonthYear(previous.month, previous.year);
  const keys = trendMonthsBack(calendar.month, calendar.year, 6);
  const rangeStart = getMonthBounds(keys[0].month, keys[0].year).start;
  const rangeEnd = getMonthBounds(keys[keys.length - 1].month, keys[keys.length - 1].year).end;

  const [stats, clients, payments, latestPayroll, lastMonthPt, monthPt] = await Promise.all([
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
      where: { employeeId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),
    getTrainerMonthlyPtRevenue(employeeId, previous.month, previous.year),
    getTrainerMonthlyPtRevenue(employeeId, calendar.month, calendar.year),
  ]);
  const split = await resolveSplitForMonth(employeeId, calendar.month, calendar.year, monthPt);

  const buckets = new Map(keys.map((key) => [`${key.year}-${key.month}`, { earnings: 0, ptRevenue: 0 }]));
  for (const payment of payments) {
    const collected = getPaymentCollectionDate(payment);
    const key = `${collected.getFullYear()}-${collected.getMonth() + 1}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.earnings += decimalToNumber(payment.trainerShareAmount);
    bucket.ptRevenue += decimalToNumber(payment.amount);
  }

  const lastMonthEarnings = buckets.get(`${previous.year}-${previous.month}`)?.earnings ?? 0;
  const now = new Date();
  let active = 0;
  let expiring = 0;
  let expired = 0;
  const in7 = addDays(startOfGymDay(), 7);
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
      title: `Your share · ${shortMonthLabel(previous.month, previous.year)}`,
      value: formatInr(lastMonthEarnings),
      subtitle: `PT collected ${formatInr(lastMonthPt)}`,
      href: "/trainer/earnings",
      highlight: true,
    },
    {
      title: "This month so far",
      value: formatInr(stats.monthlyEarnings),
      subtitle: `${calendarLabel} · PT ${formatInr(monthPt)}`,
      href: "/trainer/earnings",
    },
  ];

  return {
    booksLabel,
    calendarLabel,
    trainerName: employee.user.name,
    kpis,
    alerts,
    target: {
      hasTarget: split.hasTarget,
      targetMet: split.targetMet,
      monthlyTarget: split.monthlyTarget,
      ptRevenue: monthPt,
      splitPercent: split.splitPercent,
      label: `${calendarLabel} target`,
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
    payroll: latestPayroll
      ? {
          status: latestPayroll.status,
          netPay: decimalToNumber(latestPayroll.netPay),
          monthLabel: formatMonthYear(latestPayroll.month, latestPayroll.year),
        }
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
