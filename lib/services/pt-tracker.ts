import { prisma } from "@/lib/prisma";
import { computeRevenueSplit, getMonthYear } from "@/lib/permissions";
import { decimalToNumber } from "@/lib/utils";
import {
  resolveSplitForMonth,
  recalculateTrainerMonthSplits,
  getSplitStatusForMonth,
  paymentsCollectedInMonthWhere,
} from "@/lib/services/trainer-split";
import {
  allocateMonthlyInstallments,
  inferMonthsCount,
} from "@/lib/services/payment-allocation";
import type { UserRole } from "@prisma/client";

export async function getOwnerDashboardStats(gymId: string) {
  const now = new Date();
  const reminderDate = new Date();
  reminderDate.setDate(reminderDate.getDate() + 7);

  const [trainers, clients, payments, renewals] = await Promise.all([
    prisma.employee.count({ where: { gymId, employeeType: "TRAINER" } }),
    prisma.client.count({ where: { gymId, status: "ACTIVE" } }),
    prisma.payment.findMany({
      where: {
        ...paymentsCollectedInMonthWhere(now.getMonth() + 1, now.getFullYear()),
        subscription: { client: { gymId } },
      },
      include: {
        subscription: {
          include: {
            client: {
              include: { trainer: true },
            },
          },
        },
      },
    }),
    prisma.pTSubscription.findMany({
      where: {
        endDate: { lte: reminderDate, gte: now },
        status: { in: ["ACTIVE", "EXPIRING"] },
        client: { gymId },
      },
      include: { client: { include: { trainer: { include: { user: true } } } } },
      orderBy: { endDate: "asc" },
    }),
  ]);

  let totalRevenue = 0;
  let ownerShare = 0;
  let trainerShare = 0;

  for (const payment of payments) {
    const amount = decimalToNumber(payment.amount);
    totalRevenue += amount;
    ownerShare += decimalToNumber(payment.ownerShareAmount);
    trainerShare += decimalToNumber(payment.trainerShareAmount);
  }

  return {
    trainerCount: trainers,
    activeClients: clients,
    monthlyRevenue: totalRevenue,
    ownerShare,
    trainerShare,
    renewalsDue: renewals.map((sub) => ({
      id: sub.id,
      clientName: sub.client.name,
      trainerName: sub.client.trainer.user.name,
      endDate: sub.endDate,
      amount: decimalToNumber(sub.amount),
    })),
  };
}

export async function getTrainerDashboardStats(employeeId: string) {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [clientCount, todaySessions, expiring, payments, openSlots] = await Promise.all([
    prisma.client.count({ where: { trainerId: employeeId, status: "ACTIVE" } }),
    prisma.session.findMany({
      where: {
        trainerId: employeeId,
        scheduledAt: { gte: startOfDay, lte: endOfDay },
      },
      include: { client: true },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.pTSubscription.findMany({
      where: {
        client: { trainerId: employeeId },
        endDate: { lte: new Date(Date.now() + 7 * 86400000), gte: now },
        status: { in: ["ACTIVE", "EXPIRING"] },
      },
      include: { client: true },
      take: 5,
    }),
    prisma.payment.findMany({
      where: {
        ...paymentsCollectedInMonthWhere(now.getMonth() + 1, now.getFullYear()),
        subscription: { client: { trainerId: employeeId } },
      },
    }),
    prisma.trainerSlot.count({
      where: {
        trainerId: employeeId,
        isBlocked: false,
        clientId: null,
        startAt: { gte: now },
      },
    }),
  ]);

  const monthlyEarnings = payments.reduce(
    (sum, p) => sum + decimalToNumber(p.trainerShareAmount),
    0
  );

  return {
    clientCount,
    todaySessions,
    expiringClients: expiring,
    monthlyEarnings,
    openSlots,
  };
}

export async function getTrainerOverview(gymId: string) {
  const trainers = await prisma.employee.findMany({
    where: { gymId, employeeType: "TRAINER" },
    include: {
      user: true,
      clients: {
        where: { status: "ACTIVE" },
        include: {
          subscriptions: {
            where: { status: { in: ["ACTIVE", "EXPIRING"] } },
            orderBy: { endDate: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  const { month, year } = getMonthYear();

  const result = await Promise.all(
    trainers.map(async (trainer) => {
      const payments = await prisma.payment.findMany({
        where: {
          ...paymentsCollectedInMonthWhere(month, year),
          subscription: { client: { trainerId: trainer.id } },
        },
      });

      const revenue = payments.reduce((s, p) => s + decimalToNumber(p.amount), 0);
      const trainerShare = payments.reduce((s, p) => s + decimalToNumber(p.trainerShareAmount), 0);
      const ownerShare = payments.reduce((s, p) => s + decimalToNumber(p.ownerShareAmount), 0);
      const resolution = await resolveSplitForMonth(trainer.id, month, year, revenue);
      const splitStatus = await getSplitStatusForMonth(trainer.id, month, year, revenue);

      return {
        id: trainer.id,
        userId: trainer.userId,
        name: trainer.user.name,
        email: trainer.user.email,
        phone: trainer.phone,
        clientCount: trainer.clients.length,
        monthlyTarget: resolution.monthlyTarget,
        revenueSplitBelowTarget: resolution.splitBelow,
        revenueSplitAboveTarget: resolution.splitAbove,
        activeSplitPercent: splitStatus.activeSplit,
        targetMet: splitStatus.targetMet,
        hasTarget: splitStatus.hasTarget,
        baseSalary: decimalToNumber(trainer.baseSalary),
        monthlyRevenue: revenue,
        trainerShare,
        ownerShare,
      };
    })
  );

  return result;
}

export async function createSubscriptionWithPayment(data: {
  clientId: string;
  amount: number;
  paymentDate: Date;
  startDate: Date;
  endDate: Date;
  monthsCount?: number;
  paymentMode?: "CASH" | "UPI" | "CARD" | "BANK_TRANSFER" | "OTHER";
  proofUrl?: string;
  sessionsTotal?: number;
  notes?: string;
}) {
  const client = await prisma.client.findUnique({
    where: { id: data.clientId },
    include: { trainer: true },
  });
  if (!client) throw new Error("Client not found");

  const monthsCount =
    data.monthsCount && data.monthsCount > 0
      ? data.monthsCount
      : inferMonthsCount(data.startDate, data.endDate);

  const installments = allocateMonthlyInstallments(
    data.amount,
    data.startDate,
    monthsCount
  );

  const subscription = await prisma.$transaction(async (tx) => {
    const sub = await tx.pTSubscription.create({
      data: {
        clientId: data.clientId,
        amount: data.amount,
        paymentDate: data.paymentDate,
        startDate: data.startDate,
        endDate: data.endDate,
        monthsCount,
        sessionsTotal: data.sessionsTotal,
        notes: data.notes,
        status: data.endDate > new Date() ? "ACTIVE" : "EXPIRED",
      },
    });

    const collMonth = data.paymentDate.getMonth() + 1;
    const collYear = data.paymentDate.getFullYear();

    for (const inst of installments) {
      const existingMtd = await tx.payment.findMany({
        where: {
          ...paymentsCollectedInMonthWhere(collMonth, collYear),
          subscription: { client: { trainerId: client.trainerId } },
        },
        select: { amount: true },
      });
      const mtd = existingMtd.reduce((s, p) => s + Number(p.amount), 0);
      const resolution = await resolveSplitForMonth(
        client.trainerId,
        collMonth,
        collYear,
        mtd + inst.amount
      );
      const splitPercent = resolution.splitPercent;
      const { trainerShare, ownerShare } = computeRevenueSplit(inst.amount, splitPercent);

      await tx.payment.create({
        data: {
          subscriptionId: sub.id,
          amount: inst.amount,
          paidAt: inst.serviceDate,
          payableAt: inst.payableDate,
          collectedAt: data.paymentDate,
          installmentIndex: inst.installmentIndex,
          trainerShareAmount: trainerShare,
          ownerShareAmount: ownerShare,
          splitPercentUsed: splitPercent,
          paymentMode: data.paymentMode,
          proofUrl: inst.installmentIndex === 0 ? data.proofUrl : undefined,
        },
      });
    }

    return sub;
  });

  const collMonth = data.paymentDate.getMonth() + 1;
  const collYear = data.paymentDate.getFullYear();
  await recalculateTrainerMonthSplits(client.trainerId, collMonth, collYear);

  return subscription;
}

export async function syncSubscriptionStatuses(gymId: string) {
  const now = new Date();
  const reminderDays = (
    await prisma.gym.findUnique({ where: { id: gymId }, select: { renewalReminderDays: true } })
  )?.renewalReminderDays ?? 7;
  const expiringThreshold = new Date();
  expiringThreshold.setDate(expiringThreshold.getDate() + reminderDays);

  await prisma.pTSubscription.updateMany({
    where: {
      client: { gymId },
      endDate: { lt: now },
      status: { not: "EXPIRED" },
    },
    data: { status: "EXPIRED" },
  });

  await prisma.pTSubscription.updateMany({
    where: {
      client: { gymId },
      endDate: { gte: now, lte: expiringThreshold },
      status: "ACTIVE",
    },
    data: { status: "EXPIRING" },
  });
}

export async function getRenewalPipeline(gymId: string, days = 30) {
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + days);

  return prisma.pTSubscription.findMany({
    where: {
      client: { gymId },
      endDate: { gte: now, lte: future },
      status: { in: ["ACTIVE", "EXPIRING"] },
    },
    include: {
      client: {
        include: {
          trainer: { include: { user: true } },
        },
      },
    },
    orderBy: { endDate: "asc" },
  });
}

export function filterClientsByRole<T extends { trainerId: string }>(
  clients: T[],
  role: UserRole,
  employeeId?: string
) {
  if (role === "TRAINER" && employeeId) {
    return clients.filter((c) => c.trainerId === employeeId);
  }
  return clients;
}
