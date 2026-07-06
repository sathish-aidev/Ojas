/**
 * Setup trainers (Sai, Rohith, Rahul) and import all PT CSV files.
 * Usage: npm run import:all-clients
 * Set DATABASE_URL to production before running against Neon.
 */
import { execSync } from "child_process";

const imports = [
  { file: "resources/Impackt1_Gym - PT-Sai.csv", trainer: "Sai" },
  { file: "resources/Impackt1_Gym - PT-Rohith.csv", trainer: "Rohith" },
  { file: "resources/Impackt1_Gym - PT-Rahul.csv", trainer: "Rahul" },
];

console.log("\n=== Step 1: Setup trainers ===\n");
execSync("npx tsx scripts/setup-trainers-for-import.ts", { stdio: "inherit" });

for (const { file, trainer } of imports) {
  console.log(`\n=== Importing ${trainer} from ${file} ===\n`);
  execSync(`npx tsx scripts/import-clients-csv.ts --file "${file}" --trainer ${trainer}`, {
    stdio: "inherit",
  });
}

console.log("\n=== All client CSV imports complete ===\n");
