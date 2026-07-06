import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  await prisma.notification.deleteMany();
  await prisma.payrollLineItem.deleteMany();
  await prisma.payrollRun.deleteMany();
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
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.gym.deleteMany();

  const gym = await prisma.gym.create({
    data: {
      name: "Impackt Fitness Hyderabad",
      location: "Hyderabad, Telangana, India",
      renewalReminderDays: 7,
    },
  });

  await prisma.user.create({
    data: {
      email: "owner@impackt.gym",
      passwordHash,
      name: "Gym Owner",
      role: "OWNER",
      gymId: gym.id,
      employee: {
        create: { gymId: gym.id, employeeType: "MANAGER", baseSalary: 0 },
      },
    },
  });

  await prisma.user.create({
    data: {
      email: "supervisor@impackt.gym",
      passwordHash,
      name: "Gym Supervisor",
      role: "SUPERVISOR",
      gymId: gym.id,
      employee: {
        create: { gymId: gym.id, employeeType: "MANAGER", baseSalary: 25000 },
      },
    },
  });

  const trainerData = [
    {
      name: "Rohit",
      email: "rohit@impackt.gym",
      monthlyTarget: 60000,
      below: 40,
      above: 45,
      salary: 15000,
    },
    {
      name: "Trainer Two",
      email: "trainer2@impackt.gym",
      monthlyTarget: 50000,
      below: 40,
      above: 50,
      salary: 18000,
    },
    {
      name: "Trainer Three",
      email: "trainer3@impackt.gym",
      monthlyTarget: 55000,
      below: 45,
      above: 55,
      salary: 20000,
    },
  ];

  for (const t of trainerData) {
    await prisma.user.create({
      data: {
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
            phone: "+91 98765 43210",
          },
        },
      },
    });
  }

  console.log("Seed complete (no clients — start fresh from owner dashboard).");
  console.log("Password for all: password123");
  console.log("  Owner: owner@impackt.gym");
  console.log("  Rohit: rohit@impackt.gym (target ₹60k, 40%/45% split)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
