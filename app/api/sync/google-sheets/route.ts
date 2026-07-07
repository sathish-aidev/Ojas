import { getApiUser, unauthorized, forbidden, ok, badRequest } from "@/lib/api-utils";
import { canSyncFromSheets } from "@/lib/permissions";
import { syncAllTrainerTabs } from "@/lib/services/sheet-sync";

export async function POST() {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canSyncFromSheets(user.role)) return forbidden();

  try {
    const result = await syncAllTrainerTabs(user.gymId, {
      triggeredBy: user.id,
      source: "MANUAL",
    });
    return ok(result);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Sync failed");
  }
}
