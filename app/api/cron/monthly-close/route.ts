import { prisma } from "@/lib/prisma";
import { ok, unauthorized, badRequest } from "@/lib/api-utils";
import { runMonthlyClose, getPreviousMonth } from "@/lib/services/monthly-close";
import { cleanEnv } from "@/lib/env";

export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = cleanEnv(process.env.CRON_SECRET);
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized();
  }

  const gym = await prisma.gym.findFirst();
  if (!gym) return badRequest("No gym configured");

  const { month, year } = getPreviousMonth();

  try {
    const result = await runMonthlyClose(gym.id, month, year, "cron");
    return ok(result);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Monthly close failed");
  }
}
