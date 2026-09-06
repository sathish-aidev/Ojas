import { config } from "dotenv";
import { databaseNameFromUrl, envFilePath, parseEnvFile } from "./env-file";

export function loadStagingEnv() {
  config({ path: ".env.staging", override: true });
}

export function assertStagingDatabase() {
  if (process.argv.includes("--prod")) {
    throw new Error("Refusing --prod. Staging scripts must never use the live database.");
  }

  const appEnv = (process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || "").toLowerCase();
  if (appEnv !== "staging") {
    throw new Error("APP_ENV must be staging in .env.staging before running this script.");
  }

  const url = process.env.DATABASE_URL || "";
  if (!url) throw new Error("DATABASE_URL is missing");

  const prod = parseEnvFile(envFilePath(".env.vercel.production"));
  if (prod.DATABASE_URL && url === prod.DATABASE_URL) {
    throw new Error("DATABASE_URL matches production. Aborting.");
  }

  const name = databaseNameFromUrl(url);
  if (!/staging/i.test(url) && !/staging/i.test(name) && !process.argv.includes("--allow-dev-db")) {
    throw new Error(
      `DATABASE_URL database "${name || url}" does not look like staging. ` +
        `Use a database name containing "staging", or pass --allow-dev-db only for a dedicated dummy database.`
    );
  }
}
