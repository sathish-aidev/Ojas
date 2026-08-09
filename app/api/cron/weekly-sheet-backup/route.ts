import { prisma } from "@/lib/prisma";
import { ok, unauthorized, badRequest } from "@/lib/api-utils";
import { runWeeklySheetBackup } from "@/lib/services/weekly-sheet-backup";
import { cleanEnv } from "@/lib/env";

export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const cronSecret = cleanEnv(process.env.CRON_SECRET);
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!authorizeCron(request)) return unauthorized();

  const gym = await prisma.gym.findFirst();
  if (!gym) return badRequest("No gym configured");

  try {
    const result = await runWeeklySheetBackup(gym.id, "cron");
    return ok(result);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Weekly backup failed");
  }
}
