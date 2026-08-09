/**
 * Encode service account JSON for Vercel env var (avoids newline issues).
 * Run: npx tsx scripts/encode-google-sa.ts path/to/key.json
 */
import { readFileSync } from "fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npx tsx scripts/encode-google-sa.ts path/to/key.json");
  process.exit(1);
}

const json = readFileSync(file, "utf8").trim();
JSON.parse(json);
const encoded = Buffer.from(json, "utf8").toString("base64");
console.log("\nPaste this as GOOGLE_SERVICE_ACCOUNT_JSON in Vercel:\n");
console.log(encoded);
console.log("\nLength:", encoded.length);
