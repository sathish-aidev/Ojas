/**
 * Quick smoke test — run while dev server is up:
 *   npm run dev
 *   npm run verify:app
 *
 * Do NOT run `npm run build` while `npm run dev` is active (corrupts .next cache → 500 errors).
 */
const BASE = process.env.APP_URL ?? "http://localhost:3000";

const PATHS = ["/login", "/"];

async function check(path: string) {
  const res = await fetch(`${BASE}${path}`, { redirect: "follow" });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${path} returned ${res.status}`);
  }
  if (body.length < 100) {
    throw new Error(`${path} returned ${res.status} but body is empty (${body.length} bytes) — restart dev and delete .next`);
  }
  console.log(`  ✓ ${path} → ${res.status} (${body.length} bytes)`);
}

async function main() {
  console.log(`\nApp health check (${BASE})\n`);
  for (const path of PATHS) {
    await check(path);
  }
  console.log("\nApp health check passed.\n");
}

main().catch((err) => {
  console.error("\nApp health check FAILED:", err.message);
  console.error("If you see 500 errors, stop dev, delete .next, restart: npm run dev\n");
  process.exit(1);
});
