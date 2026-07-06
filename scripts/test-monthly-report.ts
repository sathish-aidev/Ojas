/**
 * Verify trainer monthly report totals match commission calculation.
 * Run: npm run test:monthly-report
 */
import { PrismaClient } from "@prisma/client";
import {
  getTrainerMonthlyReport,
  aggregateSubscriptionCollections,
} from "../lib/services/trainer-monthly-report";
import { calculateTrainerCommission } from "../lib/services/salaries";

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

function mainUnitTests() {
  console.log("--- Unit: aggregateSubscriptionCollections ---");
  const totals = aggregateSubscriptionCollections([
    { subscriptionId: "sub-a", amount: { toString: () => "10000" } },
    { subscriptionId: "sub-a", amount: { toString: () => "10000" } },
    { subscriptionId: "sub-a", amount: { toString: () => "10000" } },
    { subscriptionId: "sub-b", amount: { toString: () => "8000" } },
  ]);
  assert(totals.get("sub-a") === 30000, "Lump-sum installments sum per subscription");
  assert(totals.get("sub-b") === 8000, "Separate subscription tracked independently");
}

async function main() {
  console.log("\n=== Trainer Monthly Report Tests ===\n");
  mainUnitTests();

  const trainer = await prisma.employee.findFirst({
    where: { employeeType: "TRAINER" },
    include: { user: true },
  });

  if (!trainer) {
    console.log("No trainer in DB — skipping integration tests.");
    process.exit(failed > 0 ? 1 : 0);
  }

  const month = 3;
  const year = 2026;

  const report = await getTrainerMonthlyReport(trainer.id, month, year);
  assert(report !== null, "Report loads for trainer");

  if (report) {
    const rowShareSum = report.rows.reduce((s, r) => s + r.trainerShare, 0);
    const revenueSum = report.rows.reduce(
      (s, r) => s + (r.amountPaidThisMonth ?? 0),
      0
    );

    assert(
      Math.abs(rowShareSum - report.summary.totalTrainerShare) < 0.01,
      "Row trainer shares sum to summary.totalTrainerShare"
    );
    assert(
      Math.abs(revenueSum - report.summary.totalPtRevenue) < 0.01,
      "Non-null Paid This Month sums to summary.totalPtRevenue"
    );

    const commission = await calculateTrainerCommission(trainer.id, month, year);
    assert(
      Math.abs(commission - report.summary.totalTrainerShare) < 0.01,
      "calculateTrainerCommission matches report summary"
    );

    const hasPrepaidRow = report.rows.some((r) => r.amountPaidThisMonth === null);
    if (hasPrepaidRow) {
      assert(true, "Report includes service-month rows with blank Paid This Month");
    }

    console.log(
      `\n  Sample: ${trainer.user.name} ${month}/${year} — ${report.rows.length} rows, commission ₹${commission}`
    );
  }

  const rohith = await prisma.employee.findFirst({
    where: { employeeType: "TRAINER", user: { name: "Rohith" } },
  });
  if (rohith) {
    const june = await getTrainerMonthlyReport(rohith.id, 6, 2026);
    if (june) {
      const harshaRows = june.rows.filter(
        (r) => r.clientName.toLowerCase() === "harsha"
      );
      assert(harshaRows.length === 1, "Rohith June: Harsha appears once (not tripled)");
      const sud = june.rows.find((r) => r.clientName.toLowerCase().includes("sudharshan"));
      const venu = june.rows.find((r) => r.clientName.toLowerCase().includes("venu"));
      if (sud) {
        assert(sud.amountPaidThisMonth === null, "Rohith June: sudharshan Paid This Month is blank");
        assert(sud.trainerShare > 0, "Rohith June: sudharshan has trainer share");
        assert(sud.splitPercent === 45, "Rohith June: sudharshan gets 45% when target met");
      }
      if (venu) {
        assert(venu.amountPaidThisMonth === null, "Rohith June: venu Paid This Month is blank");
        assert(venu.trainerShare > 0, "Rohith June: venu has trainer share");
        assert(venu.splitPercent === 45, "Rohith June: venu gets 45% when target met");
      }
      console.log(
        `\n  Rohith June 2026: ${june.rows.length} rows, revenue ₹${june.summary.totalPtRevenue}, share ₹${june.summary.totalTrainerShare}`
      );
    }
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
