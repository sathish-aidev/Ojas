import { getApiUser, unauthorized, forbidden, ok } from "@/lib/api-utils";
import { canViewRevenueDashboard } from "@/lib/permissions";
import {
  getRevenueMonthSummary,
  getRevenueTrend,
} from "@/lib/services/revenue-summary";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canViewRevenueDashboard(user.role)) return forbidden();

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1);
  const year = Number(searchParams.get("year") ?? now.getFullYear());
  const includeTrend = searchParams.get("trend") === "1";

  const summary = await getRevenueMonthSummary(user.gymId, month, year);
  const trend = includeTrend ? await getRevenueTrend(user.gymId, month, year) : undefined;
  return ok({ summary, trend });
}
