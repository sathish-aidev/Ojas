/**
 * Restore trainer Google Sheets from the last full DB snapshot.
 *   npx tsx scripts/restore-trainer-sheets.ts --prod
 *   npx tsx scripts/restore-trainer-sheets.ts --prod --apply
 */
import { config } from "dotenv";

const prod = process.argv.includes("--prod");
const apply = process.argv.includes("--apply");
config({ path: prod ? ".env.vercel.production" : ".env", override: true });

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { TRAINER_SHEET_TABS } = await import("../lib/sheet-config");
  const { fetchSheetTab } = await import("../lib/google/sheets-client");
  const { parseGymSheetRows } = await import("../lib/import/parse-gym-sheet");
  const { writeSheetTab } = await import("../lib/google/sheets-write");
  const { syncTrainerTab } = await import("../lib/services/sheet-sync");

  const prisma = new PrismaClient();
  try {
    console.log(prod ? "Target: production" : "Target: local");

    for (const tab of TRAINER_SHEET_TABS) {
      const live = await fetchSheetTab(tab);
      const parsed = parseGymSheetRows(live);
      console.log(`Live ${tab}: ${live.length} sheet rows, ${parsed.rows.length} parsed clients`);
    }

    const gym = await prisma.gym.findFirst();
    if (!gym) throw new Error("No gym found");

    const runs = await prisma.sheetSyncRun.findMany({
      where: {
        status: "SUCCESS",
        source: { in: ["MANUAL", "DAILY", "CRON", "BACKUP"] },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { snapshots: { select: { tabName: true, rawRows: true } } },
    });

    const scored = runs.map((run) => {
      let parsed = 0;
      let raw = 0;
      for (const tab of TRAINER_SHEET_TABS) {
        const rows = (run.snapshots.find((s) => s.tabName === tab)?.rawRows as string[][]) ?? [];
        raw += rows.length;
        parsed += parseGymSheetRows(rows).rows.length;
      }
      return { run, parsed, raw };
    });
    for (const item of scored) {
      console.log(
        `${item.run.createdAt.toISOString()} ${item.run.source} raw=${item.raw} parsedClients=${item.parsed}`
      );
    }

    const best = [...scored].sort((a, b) => b.parsed - a.parsed || b.raw - a.raw)[0];
    if (!best || best.parsed < 50) throw new Error("No snapshot with enough trainer clients");
    console.log(
      `\nWill restore snapshot ${best.run.createdAt.toISOString()} (${best.run.source}) — ${best.parsed} clients`
    );

    if (!apply) {
      console.log("Dry run. Pass --apply to write these rows back to Google Sheets and the app.");
      return;
    }

    for (const tabName of TRAINER_SHEET_TABS) {
      const rawRows = best.run.snapshots.find((s) => s.tabName === tabName)?.rawRows as string[][];
      if (!rawRows?.length) throw new Error(`Missing snapshot rows for ${tabName}`);
      await writeSheetTab(tabName, rawRows);
      const parsed = parseGymSheetRows(rawRows);
      const result = await syncTrainerTab(gym.id, tabName, rawRows);
      console.log(
        `  restored ${tabName}: ${parsed.rows.length} clients, imported created=${result.created} errors=${result.errors.length}`
      );
      for (const err of result.errors.slice(0, 5)) console.log(`    ${err}`);
    }
    console.log("\nGoogle Sheets and app database restored from the last full backup.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
