/**
 * Create local Postgres database impackt_gym_staging and a starter .env.staging.
 *
 *   npx tsx scripts/prepare-staging-local.ts
 */
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { envFilePath, parseEnvFile, upsertEnvFile } from "./env-file";

const STAGING_URL = "postgresql://impackt:impackt_dev@localhost:5433/impackt_gym_staging?schema=public";

function createdb() {
  const exists = spawnSync(
    "docker",
    [
      "exec",
      "impackt-postgres",
      "psql",
      "-U",
      "impackt",
      "-d",
      "postgres",
      "-tAc",
      "SELECT 1 FROM pg_database WHERE datname='impackt_gym_staging'",
    ],
    { encoding: "utf8" }
  );
  if (exists.stdout?.trim() === "1") {
    console.log("Database impackt_gym_staging already exists.");
    return;
  }
  const create = spawnSync(
    "docker",
    ["exec", "impackt-postgres", "createdb", "-U", "impackt", "impackt_gym_staging"],
    { encoding: "utf8" }
  );
  if (create.status !== 0) {
    throw new Error(create.stderr || create.stdout || "createdb failed");
  }
  console.log("Created database impackt_gym_staging.");
}

function pushSchema() {
  const result = spawnSync("npx", ["prisma", "db", "push", "--accept-data-loss"], {
    encoding: "utf8",
    shell: true,
    env: { ...process.env, DATABASE_URL: STAGING_URL },
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "prisma db push failed");
  }
  console.log("Pushed Prisma schema to impackt_gym_staging.");
}

async function main() {
  createdb();
  pushSchema();
  const local = parseEnvFile(envFilePath(".env"));
  const prod = parseEnvFile(envFilePath(".env.vercel.production"));
  upsertEnvFile(envFilePath(".env.staging"), {
    DATABASE_URL: STAGING_URL,
    AUTH_SECRET: local.AUTH_SECRET || randomBytes(32).toString("base64"),
    AUTH_URL: "http://localhost:3001",
    APP_ENV: "staging",
    NEXT_PUBLIC_APP_ENV: "staging",
    NEXT_PUBLIC_APP_NAME: "Impackt Fitness (TEST)",
    GOOGLE_SERVICE_ACCOUNT_JSON: prod.GOOGLE_SERVICE_ACCOUNT_JSON || "",
    PRODUCTION_GOOGLE_DRIVE_FOLDER_ID: prod.GOOGLE_DRIVE_FOLDER_ID || "",
    PRODUCTION_GOOGLE_SHEETS_SPREADSHEET_ID: prod.GOOGLE_SHEETS_SPREADSHEET_ID || "",
  });
  console.log("Wrote .env.staging (gitignored).");
  console.log("Next: npx tsx scripts/setup-staging-google.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
