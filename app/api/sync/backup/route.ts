import { prisma } from "@/lib/prisma";
import {
  getApiUser,
  unauthorized,
  forbidden,
  badRequest,
  ok,
} from "@/lib/api-utils";
import { canSyncFromSheets } from "@/lib/permissions";
import { runWeeklySheetBackup } from "@/lib/services/weekly-sheet-backup";

export const maxDuration = 60;

export async function POST() {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canSyncFromSheets(user.role)) return forbidden();

  const gym = await prisma.gym.findFirst({ where: { id: user.gymId } });
  if (!gym) return badRequest("No gym configured");

  try {
    const result = await runWeeklySheetBackup(gym.id, user.email);
    return ok(result);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Backup failed");
  }
}
