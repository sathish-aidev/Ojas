/**
 * Fix trainer tab layout without dropping clients:
 * row 1 title (readable), row 2 headers, row 3 first client, freeze 2 rows.
 *
 *   npx tsx scripts/repair-trainer-sheet-layout.ts --prod
 *   npx tsx scripts/repair-trainer-sheet-layout.ts --prod --apply
 */
import { config } from "dotenv";

const prod = process.argv.includes("--prod");
const apply = process.argv.includes("--apply");
config({ path: prod ? ".env.vercel.production" : ".env", override: true });

function sameKeys(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((key, i) => key === b[i]);
}

async function main() {
  const { TRAINER_SHEET_TABS } = await import("../lib/sheet-config");
  const { fetchSheetTab } = await import("../lib/google/sheets-client");
  const {
    parseGymSheetRows,
    realignTrainerSheetRows,
    trainerSheetClientKeys,
  } = await import("../lib/import/parse-gym-sheet");
  const { writeSheetTab } = await import("../lib/google/sheets-write");

  console.log(prod ? "Target: production Google Sheet" : "Target: local Google Sheet");

  for (const tabName of TRAINER_SHEET_TABS) {
    const live = await fetchSheetTab(tabName);
    const before = parseGymSheetRows(live);
    const beforeKeys = trainerSheetClientKeys(live);
    const aligned = realignTrainerSheetRows(live, tabName);
    const after = parseGymSheetRows(aligned);
    const afterKeys = trainerSheetClientKeys(aligned);

    console.log(`\n${tabName}`);
    console.log(`  live row1: ${JSON.stringify(live[0]?.[0] ?? "")}`);
    console.log(`  live row2: ${JSON.stringify((live[1] ?? []).slice(0, 4))}`);
    console.log(`  live row3: ${JSON.stringify((live[2] ?? []).slice(0, 4))}`);
    console.log(`  clients before=${before.rows.length} after=${after.rows.length}`);
    console.log(`  aligned row2: ${JSON.stringify(aligned[1]?.slice(0, 3))}`);
    console.log(`  aligned row3: ${JSON.stringify(aligned[2]?.slice(0, 3))}`);

    if (before.errors.length) {
      console.log(`  parse errors before: ${before.errors.slice(0, 3).map((e) => e.message).join("; ")}`);
    }
    if (!sameKeys(beforeKeys, afterKeys)) {
      throw new Error(
        `${tabName}: refusing to write — client set would change (${beforeKeys.length} → ${afterKeys.length})`
      );
    }

    if (!apply) continue;

    await writeSheetTab(tabName, aligned);
    const verify = await fetchSheetTab(tabName);
    const verifyParsed = parseGymSheetRows(verify);
    const verifyKeys = trainerSheetClientKeys(verify);
    if (!sameKeys(beforeKeys, verifyKeys) || verifyParsed.rows.length !== before.rows.length) {
      throw new Error(`${tabName}: write-back verification failed — client set changed`);
    }
    if ((verify[1]?.[0] ?? "").toLowerCase() !== "customer") {
      throw new Error(`${tabName}: headers are not on row 2 after write`);
    }
    console.log(`  wrote and verified ${verifyParsed.rows.length} clients`);
  }

  if (!apply) {
    console.log("\nDry run. Pass --apply to rewrite the three trainer tabs.");
    return;
  }
  console.log("\nLayout repaired. Title row 1, headers row 2, clients from row 3. Freeze is 2 rows.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
