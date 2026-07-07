import { prisma } from "@/lib/prisma";
import { ok, unauthorized, badRequest } from "@/lib/api-utils";
import { runWeeklySheetBackup } from "@/lib/services/weekly-sheet-backup";

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized();
  }

  const gym = await prisma.gym.findFirst();
  if (!gym) return badRequest("No gym configured");

  try {
    const result = await runWeeklySheetBackup(gym.id, "cron");
    return ok(result);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Weekly backup failed");
  }
}
