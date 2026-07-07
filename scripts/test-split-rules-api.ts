/**
 * Smoke test for split-rules service (no HTTP auth required).
 *   npm run test:split-rules-api
 */
import { prisma } from "../lib/prisma";
import { listSplitRules, updateSplitRule } from "../lib/services/trainer-split-rules";

async function main() {
  const sai = await prisma.employee.findFirst({
    where: { employeeType: "TRAINER", user: { name: "Sai Karan" } },
    select: { id: true },
  });
  if (!sai) throw new Error("Sai Karan trainer not found");

  const rules = await listSplitRules(sai.id);
  if (rules.length === 0) throw new Error("No split rules for Sai Karan");

  const janRule = rules.find((r) => r.startMonth === 1 && r.startYear === 2026);
  if (!janRule) throw new Error("Sai Karan Jan 2026 rule not found");

  const result = await updateSplitRule(
    janRule.id,
    { notes: janRule.notes ?? "Jan flat 45%" },
    false
  );
  if (result.rule.id !== janRule.id) throw new Error("PATCH update failed");

  console.log("  ✓ listSplitRules");
  console.log("  ✓ updateSplitRule (PATCH path)");
  console.log(`\nSplit rules API smoke test passed (${rules.length} rules for Sai Karan).\n`);
}

main()
  .catch((err) => {
    console.error("\nSplit rules API test FAILED:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
