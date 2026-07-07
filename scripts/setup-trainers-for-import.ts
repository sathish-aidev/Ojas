/**
 * Upsert trainers Sai Karan, Rohith, Rahul for CSV import without wiping existing data.
 * Run: npx tsx scripts/setup-trainers-for-import.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { upsertSplitRulesForTrainer } from "../lib/services/trainer-split-rules";
import type { CreateSplitRuleInput } from "../lib/services/trainer-split-rules";

const prisma = new PrismaClient();

const TRAINERS: Array<{
  name: string;
  email: string;
  monthlyTarget: number;
  below: number;
  above: number;
  salary: number;
  targetSplitAppliesFrom?: Date;
  splitRules?: CreateSplitRuleInput[];
}> = [
  {
    name: "Sai Karan",
    email: "sai@impackt.gym",
    monthlyTarget: 60000,
    below: 45,
    above: 50,
    salary: 15000,
    splitRules: [
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
    ],
  },
  {
    name: "Rohith",
    email: "rohith@impackt.gym",
    monthlyTarget: 60000,
    below: 40,
    above: 45,
    salary: 15000,
    targetSplitAppliesFrom: new Date(2026, 5, 1), // June 2026 — flat 40% through May
    splitRules: [
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
    ],
  },
  {
    name: "Rahul",
    email: "rahul@impackt.gym",
    monthlyTarget: 55000,
    below: 50,
    above: 50,
    salary: 18000,
  },
];

async function main() {
  const gym = await prisma.gym.findFirst();
  if (!gym) {
    console.error("No gym found. Run npm run db:seed first.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash("password123", 10);

  for (const t of TRAINERS) {
    const existing = await prisma.user.findFirst({
      where: { gymId: gym.id, name: t.name, role: "TRAINER" },
      include: { employee: true },
    });

    if (existing?.employee) {
      await prisma.employee.update({
        where: { id: existing.employee.id },
        data: {
          monthlyTarget: t.monthlyTarget,
          revenueSplitBelowTarget: t.below,
          revenueSplitAboveTarget: t.above,
          baseSalary: t.salary,
          targetSplitAppliesFrom: t.targetSplitAppliesFrom ?? null,
        },
      });
      console.log(`Updated trainer: ${t.name} (${existing.employee.id})`);
      if (t.splitRules) {
        await upsertSplitRulesForTrainer(existing.employee.id, t.splitRules);
      }
    } else {
      const user = await prisma.user.create({
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
              targetSplitAppliesFrom: t.targetSplitAppliesFrom ?? null,
            },
          },
        },
        include: { employee: true },
      });
      console.log(`Created trainer: ${t.name} (${user.employee!.id})`);
      if (t.splitRules && user.employee) {
        await upsertSplitRulesForTrainer(user.employee.id, t.splitRules);
      }
    }
  }

  console.log("\nTrainers ready for import. Password: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
