/**
 * Wipe and load dummy gym data for the TEST environment.
 * Never run against production.
 *
 *   npx tsx scripts/seed-staging.ts
 */
import { config } from "dotenv";
config({ path: ".env.staging", override: true });

import { assertStagingDatabase } from "./assert-staging-env";
assertStagingDatabase();

import bcrypt from "bcryptjs";
import type { ExpenseCategory, ExpenseKind, PaymentMode } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { createSubscriptionWithPayment } from "../lib/services/pt-tracker";
import { generatePayrollForGym, markPayrollPaid } from "../lib/services/salaries";
import { upsertSplitRulesForTrainer } from "../lib/services/trainer-split-rules";
import { formatDateDMY } from "../lib/import/parse-csv-dates";
import { decimalToNumber } from "../lib/utils";
import { isProductionGoogleId } from "../lib/google/production-google-ids";

function atNoon(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

async function wipeGym() {
  await prisma.notification.deleteMany();
  await prisma.sheetTabSnapshot.deleteMany();
  await prisma.sheetSyncRun.deleteMany();
  await prisma.payrollLineItem.deleteMany();
  await prisma.payrollRun.deleteMany();
  await prisma.monthlySalaryOverride.deleteMany();
  await prisma.progressPhoto.deleteMany();
  await prisma.dietProgram.deleteMany();
  await prisma.clientNote.deleteMany();
  await prisma.measurement.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.pTSubscription.deleteMany();
  await prisma.session.deleteMany();
  await prisma.trainerSlot.deleteMany();
  await prisma.client.deleteMany();
  await prisma.trainerSplitRule.deleteMany();
  await prisma.gymExpense.deleteMany();
  await prisma.cultSettlement.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.gym.deleteMany();
}

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);
  await wipeGym();

  const gym = await prisma.gym.create({
    data: {
      name: "Impackt Fitness (TEST)",
      location: "Hyderabad — dummy test gym",
      renewalReminderDays: 7,
    },
  });

  const owner = await prisma.user.create({
    data: {
      username: "owner",
      email: "owner@impackt.gym",
      passwordHash,
      name: "Gym Owner",
      role: "OWNER",
      gymId: gym.id,
      employee: {
        create: { gymId: gym.id, employeeType: "MANAGER", baseSalary: 0 },
      },
    },
    include: { employee: true },
  });

  const supervisor = await prisma.user.create({
    data: {
      username: "lokesh",
      email: "lokesh@impackt.gym",
      passwordHash,
      name: "Lokesh",
      role: "SUPERVISOR",
      gymId: gym.id,
      employee: {
        create: { gymId: gym.id, employeeType: "MANAGER", baseSalary: 25000 },
      },
    },
    include: { employee: true },
  });

  for (const name of ["Yashoda", "Rama"] as const) {
    const username = name.toLowerCase();
    await prisma.user.create({
      data: {
        username,
        email: `${username}@impackt.gym`,
        passwordHash,
        name,
        role: "TRAINER",
        gymId: gym.id,
        isActive: false,
        employee: {
          create: { gymId: gym.id, employeeType: "CLEANING", baseSalary: 12000 },
        },
      },
    });
  }

  const trainers = [
    {
      name: "Rahul",
      username: "rahul",
      email: "rahul@impackt.gym",
      salary: 18000,
      monthlyTarget: 55000,
      below: 50,
      above: 50,
    },
    {
      name: "Rohith",
      username: "rohit",
      email: "rohith@impackt.gym",
      salary: 15000,
      monthlyTarget: 60000,
      below: 40,
      above: 45,
    },
    {
      name: "Sai Karan",
      username: "saikaran",
      email: "sai@impackt.gym",
      salary: 15000,
      monthlyTarget: 60000,
      below: 45,
      above: 50,
    },
  ] as const;

  const trainerByName: Record<string, { userId: string; employeeId: string }> = {};

  for (const t of trainers) {
    const user = await prisma.user.create({
      data: {
        username: t.username,
        email: t.email,
        passwordHash,
        name: t.name,
        role: "TRAINER",
        gymId: gym.id,
        employee: {
          create: {
            gymId: gym.id,
            employeeType: "TRAINER",
            baseSalary: t.salary,
            monthlyTarget: t.monthlyTarget,
            revenueSplitBelowTarget: t.below,
            revenueSplitAboveTarget: t.above,
            phone: "9000000000",
          },
        },
      },
      include: { employee: true },
    });
    trainerByName[t.name] = { userId: user.id, employeeId: user.employee!.id };
  }

  await upsertSplitRulesForTrainer(trainerByName.Rahul.employeeId, [
    {
      startMonth: 1,
      startYear: 2026,
      mode: "FLAT",
      flatPercent: 50,
    },
  ]);
  await upsertSplitRulesForTrainer(trainerByName.Rohith.employeeId, [
    {
      startMonth: 1,
      startYear: 2026,
      endMonth: 5,
      endYear: 2026,
      mode: "FLAT",
      flatPercent: 40,
    },
    {
      startMonth: 6,
      startYear: 2026,
      mode: "TARGET_BASED",
      monthlyTarget: 60000,
      splitBelowTarget: 40,
      splitAboveTarget: 45,
    },
  ]);
  await upsertSplitRulesForTrainer(trainerByName["Sai Karan"].employeeId, [
    {
      startMonth: 1,
      startYear: 2026,
      endMonth: 1,
      endYear: 2026,
      mode: "FLAT",
      flatPercent: 45,
    },
    {
      startMonth: 2,
      startYear: 2026,
      mode: "TARGET_BASED",
      monthlyTarget: 60000,
      splitBelowTarget: 45,
      splitAboveTarget: 50,
    },
  ]);

  async function addClient(input: {
    name: string;
    trainer: string;
    phone: string;
    amount: number;
    start: Date;
    end: Date;
    months: number;
    paidOn: Date;
    mode?: PaymentMode;
    notes?: string;
  }) {
    const trainer = trainerByName[input.trainer];
    const client = await prisma.client.create({
      data: {
        gymId: gym.id,
        trainerId: trainer.employeeId,
        name: input.name,
        phone: input.phone,
        joinDate: input.start,
        status: input.end >= atNoon(2026, 9, 6) ? "ACTIVE" : "EXPIRED",
      },
    });
    await createSubscriptionWithPayment({
      clientId: client.id,
      amount: input.amount,
      paymentDate: input.paidOn,
      startDate: input.start,
      endDate: input.end,
      monthsCount: input.months,
      paymentMode: input.mode ?? "UPI",
      notes: input.notes ?? "TEST dummy pack",
    });
    return client;
  }

  const anika = await addClient({
    name: "Test Anika Sharma",
    trainer: "Rahul",
    phone: "9000000001",
    amount: 20000,
    start: atNoon(2026, 8, 17),
    end: atNoon(2026, 10, 17),
    months: 2,
    paidOn: atNoon(2026, 8, 17),
    notes: "Active 2-month pack",
  });
  await addClient({
    name: "Test Bharat Reddy",
    trainer: "Rahul",
    phone: "9000000002",
    amount: 12000,
    start: atNoon(2026, 8, 10),
    end: atNoon(2026, 9, 10),
    months: 1,
    paidOn: atNoon(2026, 8, 10),
    notes: "Due for renewal this week",
  });
  await addClient({
    name: "Test Old Meera",
    trainer: "Rahul",
    phone: "9000000003",
    amount: 15000,
    start: atNoon(2026, 5, 1),
    end: atNoon(2026, 7, 1),
    months: 2,
    paidOn: atNoon(2026, 5, 1),
  });

  await addClient({
    name: "Test Chitra Nair",
    trainer: "Rohith",
    phone: "9000000004",
    amount: 28000,
    start: atNoon(2026, 7, 1),
    end: atNoon(2026, 11, 1),
    months: 4,
    paidOn: atNoon(2026, 7, 1),
  });
  await addClient({
    name: "Test Old Kiran",
    trainer: "Rohith",
    phone: "9000000005",
    amount: 18000,
    start: atNoon(2026, 3, 1),
    end: atNoon(2026, 6, 1),
    months: 3,
    paidOn: atNoon(2026, 3, 1),
  });

  const dev = await addClient({
    name: "Test Dev Patel",
    trainer: "Sai Karan",
    phone: "9000000006",
    amount: 16000,
    start: atNoon(2026, 8, 15),
    end: atNoon(2026, 10, 15),
    months: 2,
    paidOn: atNoon(2026, 8, 15),
  });
  await addClient({
    name: "Test Old Farah",
    trainer: "Sai Karan",
    phone: "9000000007",
    amount: 10000,
    start: atNoon(2026, 6, 20),
    end: atNoon(2026, 8, 20),
    months: 2,
    paidOn: atNoon(2026, 6, 20),
  });
  await addClient({
    name: "Test Old Gopal",
    trainer: "Sai Karan",
    phone: "9000000008",
    amount: 8000,
    start: atNoon(2026, 3, 1),
    end: atNoon(2026, 4, 30),
    months: 2,
    paidOn: atNoon(2026, 3, 1),
  });

  await prisma.goal.create({
    data: {
      clientId: anika.id,
      goalType: "WEIGHT_LOSS",
      title: "Lose 4 kg",
      targetValue: 4,
      currentValue: 1.5,
      unit: "kg",
      deadline: atNoon(2026, 11, 1),
    },
  });
  await prisma.measurement.create({
    data: {
      clientId: anika.id,
      type: "WEIGHT",
      value: 68.5,
      unit: "kg",
      recordedAt: atNoon(2026, 9, 1),
    },
  });
  await prisma.clientNote.create({
    data: {
      clientId: anika.id,
      content: "Dummy note — prefers evening slots.",
      isPinned: true,
    },
  });

  const today = new Date();
  const slotStart = new Date(today);
  slotStart.setHours(7, 0, 0, 0);
  const slotEnd = new Date(today);
  slotEnd.setHours(8, 0, 0, 0);
  await prisma.trainerSlot.create({
    data: {
      gymId: gym.id,
      trainerId: trainerByName.Rahul.employeeId,
      startAt: slotStart,
      endAt: slotEnd,
      label: "Morning PT",
      clientId: anika.id,
    },
  });
  await prisma.session.create({
    data: {
      clientId: dev.id,
      trainerId: trainerByName["Sai Karan"].employeeId,
      scheduledAt: slotStart,
      startTime: slotStart,
      endTime: slotEnd,
      status: "SCHEDULED",
      notes: "Dummy session for Schedule screen",
    },
  });

  async function addExpense(input: {
    date: Date;
    kind: ExpenseKind;
    category: ExpenseCategory;
    description: string;
    amount: number;
    paidBy: string;
    mode?: PaymentMode;
  }) {
    await prisma.gymExpense.create({
      data: {
        gymId: gym.id,
        date: input.date,
        month: input.date.getMonth() + 1,
        year: input.date.getFullYear(),
        kind: input.kind,
        category: input.category,
        description: input.description,
        amount: input.amount,
        paymentMode: input.mode ?? "BANK_TRANSFER",
        paidBy: input.paidBy,
        createdByUserId: input.kind === "SUPERVISOR_SPEND" ? supervisor.id : owner.id,
        source: "APP",
      },
    });
  }

  await addExpense({
    date: atNoon(2026, 7, 5),
    kind: "OWNER_BILL",
    category: "RENT",
    description: "TEST rent July",
    amount: 150000,
    paidBy: "Owner",
  });
  await addExpense({
    date: atNoon(2026, 7, 12),
    kind: "OWNER_BILL",
    category: "POWER_BILL",
    description: "TEST power July",
    amount: 22000,
    paidBy: "Owner",
  });
  await addExpense({
    date: atNoon(2026, 8, 3),
    kind: "SUPERVISOR_ADVANCE",
    category: "MAINTENANCE",
    description: "TEST cash given to supervisor",
    amount: 10000,
    paidBy: "Owner",
    mode: "CASH",
  });
  await addExpense({
    date: atNoon(2026, 8, 18),
    kind: "SUPERVISOR_SPEND",
    category: "REPAIRS",
    description: "TEST plumber repair",
    amount: 2500,
    paidBy: "Lokesh",
    mode: "CASH",
  });

  await prisma.cultSettlement.create({
    data: {
      gymId: gym.id,
      month: 7,
      year: 2026,
      partnerShare: 720000,
      tds: 72000,
      taxInvoiceGrossTotal: 850000,
      notes: "Dummy July Cult figures for Revenue testing",
      enteredByUserId: owner.id,
    },
  });

  const juneRuns = await generatePayrollForGym(gym.id, 6, 2026);
  for (const run of juneRuns) {
    await markPayrollPaid(run.id, atNoon(2026, 7, 5), "TEST marked paid");
  }
  await generatePayrollForGym(gym.id, 7, 2026);

  const sheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (sheetId && !isProductionGoogleId(sheetId) && process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const { exportGymToGoogleSheet } = await import("../lib/services/sheet-export");
    const { rewriteExpenseSheet, ensureExpenseSheets } = await import("../lib/google/expense-sheet");
    await ensureExpenseSheets();
    await exportGymToGoogleSheet(gym.id);
    const expenses = await prisma.gymExpense.findMany({ where: { gymId: gym.id } });
    await rewriteExpenseSheet(
      expenses.map((row) => ({
        id: row.id,
        dateLabel: formatDateDMY(row.date),
        kind: row.kind,
        category: row.category,
        description: row.description,
        amount: decimalToNumber(row.amount),
        paymentMode: row.paymentMode,
        paidBy: row.paidBy,
        notes: row.notes,
      }))
    );
    console.log("Exported dummy PT and expenses to the TEST Google Sheet.");
  } else {
    console.log("Skipped Google Sheet export (no TEST sheet configured).");
  }

  const clients = await prisma.client.count({ where: { gymId: gym.id } });
  console.log("\nStaging dummy gym ready.");
  console.log(`  Gym: ${gym.name}`);
  console.log(`  Clients: ${clients}`);
  console.log("  Logins (password password123): owner, lokesh, rahul, rohit, saikaran");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
