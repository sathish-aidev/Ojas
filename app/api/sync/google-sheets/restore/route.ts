import { getApiUser, unauthorized, forbidden, ok, badRequest } from "@/lib/api-utils";
import { canRestoreSheetSync } from "@/lib/permissions";
import { restoreSheetSyncRun } from "@/lib/services/sheet-sync";

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canRestoreSheetSync(user.role)) return forbidden();

  const body = await request.json();
  const syncRunId = body.syncRunId as string | undefined;
  if (!syncRunId) return badRequest("syncRunId is required");

  try {
    const result = await restoreSheetSyncRun(syncRunId, user.gymId);
    return ok(result);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Restore failed");
  }
}
