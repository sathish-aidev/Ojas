import { getApiUser, unauthorized, forbidden, ok, badRequest } from "@/lib/api-utils";
import { canSyncFromSheets } from "@/lib/permissions";
import { syncAllTrainerTabs } from "@/lib/services/sheet-sync";

export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canSyncFromSheets(user.role)) return forbidden();

  const body = (await request.json().catch(() => ({}))) as { source?: string };

  try {
    const result = await syncAllTrainerTabs(user.gymId, {
      triggeredBy: user.id,
      source: body.source === "DAILY" ? "DAILY" : "MANUAL",
      skipExport: true,
    });
    return ok(result);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Sync failed");
  }
}
