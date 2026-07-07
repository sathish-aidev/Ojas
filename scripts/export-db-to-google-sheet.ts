/**
 * Export all PT subscriptions from DB → Google Sheet (master copy).
 * Run: npx tsx scripts/export-db-to-google-sheet.ts
 */
import { prisma } from "../lib/prisma";
import { exportGymToGoogleSheet } from "../lib/services/sheet-export";

async function main() {
  const gym = await prisma.gym.findFirst();
  if (!gym) {
    console.error("No gym found.");
    process.exit(1);
  }

  console.log(`\nExporting all clients to Google Sheet for gym: ${gym.name}`);
  const results = await exportGymToGoogleSheet(gym.id);

  console.log("\nExport complete:");
  for (const r of results) {
    console.log(`  ${r.tabName}: ${r.rowCount} subscription rows`);
  }
  console.log(
    "\nSheet is now the master copy. Use Salaries → Sync to pull changes into the app."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
