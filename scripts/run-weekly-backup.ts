import { prisma } from "../lib/prisma";
import { runWeeklySheetBackup } from "../lib/services/weekly-sheet-backup";

async function main() {
  const gym = await prisma.gym.findFirst();
  if (!gym) throw new Error("No gym found");
  const result = await runWeeklySheetBackup(gym.id, "manual");
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
