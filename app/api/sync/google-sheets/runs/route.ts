import { getApiUser, unauthorized, forbidden, ok } from "@/lib/api-utils";
import { canSyncFromSheets } from "@/lib/permissions";
import { getSheetSyncRuns } from "@/lib/services/sheet-sync";

export async function GET() {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canSyncFromSheets(user.role)) return forbidden();

  const runs = await getSheetSyncRuns(user.gymId);
  return ok(runs);
}
