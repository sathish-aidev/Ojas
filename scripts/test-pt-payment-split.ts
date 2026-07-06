/**
 * PT payment split test plan — run after any payment/split changes:
 *   npm run test:pt-split
 */
import { PrismaClient } from "@prisma/client";
import { allocateMonthlyInstallments, inferMonthsCount } from "../lib/services/payment-allocation";
import {
  getEffectiveSplitPercent,
  usesTargetBasedSplit,
  resolveSplitForMonth,
} from "../lib/services/trainer-split";
import { computeRevenueSplit } from "../lib/permissions";
import { createClientWithPtSchema } from "../lib/validations";

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

async function main() {
  console.log("\n=== PT Payment Split Test Plan ===\n");

  console.log("1. Monthly allocation (₹20,000 / 2 months, start 03/05/2026)");
  const start = new Date(2026, 4, 3, 12, 0, 0);
  const installments = allocateMonthlyInstallments(20000, start, 2);
  assert(installments.length === 2, "Creates 2 installments");
  assert(installments[0].amount === 10000, "Month 1 = ₹10,000");
  assert(installments[1].amount === 10000, "Month 2 = ₹10,000");
  assert(installments[0].serviceDate.getMonth() === 4, "Month 1 service = May");
  assert(installments[1].serviceDate.getMonth() === 5, "Month 2 service = June");

  console.log("\n2. Split % when target NOT met (40% on ₹10,000)");
  const belowConfig = {
    monthlyTarget: 60000,
    revenueSplitBelowTarget: 40,
    revenueSplitAboveTarget: 45,
    targetSplitAppliesFrom: null,
  };
  const splitBelow = getEffectiveSplitPercent(belowConfig, 10000);
  const shareBelow = computeRevenueSplit(10000, splitBelow);
  assert(splitBelow === 40, "Uses 40% when revenue below target");
  assert(shareBelow.trainerShare === 4000, "Trainer share = ₹4,000");

  console.log("\n3. Split % when target IS met (45% on ₹10,000)");
  const splitAbove = getEffectiveSplitPercent(belowConfig, 60000);
  const shareAbove = computeRevenueSplit(10000, splitAbove);
  assert(splitAbove === 45, "Uses 45% when monthly revenue ≥ target");
  assert(shareAbove.trainerShare === 4500, "Trainer share = ₹4,500 when target met");

  console.log("\n4. Infer months from date range");
  const end = new Date(2026, 6, 3, 12, 0, 0);
  assert(inferMonthsCount(start, end) === 2, "May 3 → Jul 3 = 2 months");

  console.log("\n5. Form validation — empty optional sessions field");
  const parsed = createClientWithPtSchema.safeParse({
    name: "Sudarshan",
    trainerId: "trainer-id",
    amount: "20000",
    paymentDate: "2026-05-01",
    startDate: "2026-05-03",
    endDate: "2026-07-03",
    monthsCount: "2",
    paymentMode: "UPI",
    sessionsTotal: "",
    ptNotes: "Sudarshan",
  });
  assert(parsed.success, "Empty sessionsTotal does not fail validation");

  console.log("\n6. Odd amount split (₹20,001 / 3 months)");
  const three = allocateMonthlyInstallments(20001, start, 3);
  const threeTotal = three.reduce((s, i) => s + i.amount, 0);
  assert(three.length === 3, "Creates 3 installments");
  assert(threeTotal === 20001, `Installments sum to total (got ${threeTotal})`);

  console.log("\n7. Rohith flat 40% through May 2026, target rules from June (legacy)");
  const rohithConfig = {
    monthlyTarget: 60000,
    revenueSplitBelowTarget: 40,
    revenueSplitAboveTarget: 45,
    targetSplitAppliesFrom: new Date(2026, 5, 1),
  };
  assert(
    getEffectiveSplitPercent(rohithConfig, 66000, 5, 2026) === 40,
    "May 2026 uses flat 40% even when revenue exceeds target"
  );
  assert(
    getEffectiveSplitPercent(rohithConfig, 66000, 6, 2026) === 45,
    "June 2026 uses 45% when target met"
  );
  assert(!usesTargetBasedSplit(rohithConfig, 5, 2026), "May is flat split period");

  console.log("\n8. Sai split rules (Jan flat 45%, Feb+ target 45/50)");
  const sai = await prisma.employee.findFirst({
    where: { employeeType: "TRAINER", user: { name: "Sai" } },
  });

  if (!sai) {
    console.log("  (skipped — Sai not in DB; run npm run migrate:split-rules)");
  } else {
    const jan = await resolveSplitForMonth(sai.id, 1, 2026, 50000);
    assert(jan.splitPercent === 45, "Sai Jan 2026 flat 45%");
    assert(jan.flatSplitPeriod === true, "Sai Jan is flat period");

    const febBelow = await resolveSplitForMonth(sai.id, 2, 2026, 50000);
    assert(febBelow.splitPercent === 45, "Sai Feb 2026 below target = 45%");

    const febAbove = await resolveSplitForMonth(sai.id, 2, 2026, 65000);
    assert(febAbove.splitPercent === 50, "Sai Feb 2026 target met = 50%");
    assert(febAbove.targetMet === true, "Sai Feb target met flag");
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
