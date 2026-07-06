/**
 * Migrate legacy Employee split fields to TrainerSplitRule periods.
 * Run: npx tsx scripts/migrate-split-rules.ts
 */
import { PrismaClient } from "@prisma/client";
import { upsertSplitRulesForTrainer } from "../lib/services/trainer-split-rules";
import type { CreateSplitRuleInput } from "../lib/services/trainer-split-rules";

const prisma = new PrismaClient();

const TRAINER_RULES: Record<string, CreateSplitRuleInput[]> = {
  Sai: [
    {
      startMonth: 1,
      startYear: 2026,
      endMonth: 1,
      endYear: 2026,
      mode: "FLAT",
      flatPercent: 45,
      notes: "Jan 2026 flat rate",
    },
    {
      startMonth: 2,
      startYear: 2026,
      mode: "TARGET_BASED",
      monthlyTarget: 60000,
      splitBelowTarget: 45,
      splitAboveTarget: 50,
      notes: "Target-based from Feb 2026",
    },
  ],
  Rohith: [
    {
      startMonth: 1,
      startYear: 2026,
      endMonth: 5,
      endYear: 2026,
      mode: "FLAT",
      flatPercent: 40,
      notes: "Flat 40% through May 2026",
    },
    {
      startMonth: 6,
      startYear: 2026,
      mode: "TARGET_BASED",
      monthlyTarget: 60000,
      splitBelowTarget: 40,
      splitAboveTarget: 45,
      notes: "Target-based from Jun 2026",
    },
  ],
  Rahul: [
    {
      startMonth: 1,
      startYear: 2026,
      mode: "TARGET_BASED",
      monthlyTarget: 55000,
      splitBelowTarget: 50,
      splitAboveTarget: 50,
      notes: "Flat 50% via target rules",
    },
  ],
};

async function main() {
  const trainers = await prisma.employee.findMany({
    where: { employeeType: "TRAINER" },
    include: { user: true },
  });

  for (const trainer of trainers) {
    const name = trainer.user.name;
    const preset = TRAINER_RULES[name];

    if (preset) {
      await upsertSplitRulesForTrainer(trainer.id, preset);
      console.log(`Migrated ${name}: ${preset.length} rule(s) from preset`);
      continue;
    }

    const existing = await prisma.trainerSplitRule.count({ where: { employeeId: trainer.id } });
    if (existing > 0) {
      console.log(`Skipped ${name}: already has rules`);
      continue;
    }

    const below = Number(trainer.revenueSplitBelowTarget) || 50;
    const above = Number(trainer.revenueSplitAboveTarget) || below;
    const target = trainer.monthlyTarget ? Number(trainer.monthlyTarget) : null;
    const appliesFrom = trainer.targetSplitAppliesFrom;

    const rules: CreateSplitRuleInput[] = [];

    if (appliesFrom) {
      const fromMonth = appliesFrom.getMonth() + 1;
      const fromYear = appliesFrom.getFullYear();
      const flatEndOrd = fromYear * 12 + fromMonth - 1;
      if (flatEndOrd >= 2026 * 12 + 1) {
        const endYear = Math.floor((flatEndOrd - 1) / 12);
        const endMonth = ((flatEndOrd - 1) % 12) + 1;
        rules.push({
          startMonth: 1,
          startYear: 2026,
          endMonth,
          endYear,
          mode: "FLAT",
          flatPercent: below,
        });
      }
      rules.push({
        startMonth: fromMonth,
        startYear: fromYear,
        mode: "TARGET_BASED",
        monthlyTarget: target ?? 0,
        splitBelowTarget: below,
        splitAboveTarget: above,
      });
    } else {
      rules.push({
        startMonth: 1,
        startYear: 2026,
        mode: "TARGET_BASED",
        monthlyTarget: target ?? 0,
        splitBelowTarget: below,
        splitAboveTarget: above,
      });
    }

    await upsertSplitRulesForTrainer(trainer.id, rules);
    console.log(`Migrated ${name}: ${rules.length} rule(s) from legacy fields`);
  }

  console.log("\nDone. Run: npm run recalculate:trainer-splits -- <Name>");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
