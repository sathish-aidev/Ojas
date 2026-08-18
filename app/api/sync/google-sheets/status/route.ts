import { getApiUser, unauthorized, forbidden, ok } from "@/lib/api-utils";
import { canSyncFromSheets } from "@/lib/permissions";
import { getDailyPtSyncStatus } from "@/lib/services/sheet-sync";

export async function GET() {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canSyncFromSheets(user.role)) return forbidden();

  const status = await getDailyPtSyncStatus(user.gymId);
  return ok(status);
}
