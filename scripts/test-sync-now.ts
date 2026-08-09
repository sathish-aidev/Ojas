import { prisma } from "../lib/prisma";
import { syncAllTrainerTabs } from "../lib/services/sheet-sync";

async function main() {
  const gym = await prisma.gym.findFirst();
  if (!gym) throw new Error("No gym");
  const { summary } = await syncAllTrainerTabs(gym.id, { source: "MANUAL" });
  console.log("Status:", summary.status);
  console.log("Created:", summary.totalCreated, "Updated:", summary.totalUpdated);
  console.log("Errors:", summary.totalErrors);
  if (summary.totalErrors) {
    for (const tab of summary.tabs) {
      for (const err of tab.errors.slice(0, 3)) {
        console.log(`  ${tab.tabName}: ${err}`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
