import { cleanEnv } from "@/lib/env";
import { isProductionApp } from "@/lib/app-env";

/** Live gym Drive folder used by ojas-chi. Never use this ID outside production. */
export const KNOWN_PRODUCTION_DRIVE_FOLDER_ID = "1Jb8g5gFUdiIdBEwHMaOEDLetK0GK9FHN";

function addId(ids: Set<string>, value: string | undefined) {
  const id = value?.trim();
  if (id) ids.add(id);
}

export function productionGoogleIdDenylist(): Set<string> {
  const ids = new Set<string>();
  addId(ids, KNOWN_PRODUCTION_DRIVE_FOLDER_ID);
  addId(ids, cleanEnv(process.env.PRODUCTION_GOOGLE_DRIVE_FOLDER_ID));
  addId(ids, cleanEnv(process.env.PRODUCTION_GOOGLE_SHEETS_SPREADSHEET_ID));
  addId(ids, cleanEnv(process.env.PRODUCTION_GOOGLE_EXPENSES_SPREADSHEET_ID));
  addId(ids, cleanEnv(process.env.PRODUCTION_GOOGLE_BACKUP_SPREADSHEET_ID));
  const extra = cleanEnv(process.env.PRODUCTION_GOOGLE_ID_DENYLIST);
  if (extra) {
    for (const part of extra.split(/[\s,]+/)) addId(ids, part);
  }
  return ids;
}

export function isProductionGoogleId(id: string | undefined | null): boolean {
  if (!id) return false;
  return productionGoogleIdDenylist().has(id.trim());
}

/** Block live Sheet/Drive IDs unless this process is the real production app. */
export function assertGoogleIdAllowed(kind: string, id: string) {
  if (isProductionApp()) return;
  if (cleanEnv(process.env.ALLOW_PRODUCTION_GOOGLE) === "1") return;
  if (!isProductionGoogleId(id)) return;
  throw new Error(
    `Refusing to use the live Google ${kind} (${id}) because APP_ENV is not production. ` +
      `Point staging at the TEST folder/spreadsheet, or set APP_ENV=production only on ojas-chi.vercel.app.`
  );
}
