import {
  getApiUser,
  unauthorized,
  forbidden,
  badRequest,
  ok,
} from "@/lib/api-utils";
import { canManageCultSettlements } from "@/lib/permissions";
import { cultSettlementSchema } from "@/lib/validations";
import {
  getCultSettlement,
  upsertCultSettlement,
} from "@/lib/services/cult-settlements";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canManageCultSettlements(user.role)) return forbidden();

  const { searchParams } = new URL(request.url);
  const month = Number(searchParams.get("month") ?? new Date().getMonth() + 1);
  const year = Number(searchParams.get("year") ?? new Date().getFullYear());
  if (month < 1 || month > 12 || year < 2020) return badRequest("Invalid month/year");

  const settlement = await getCultSettlement(user.gymId, month, year);
  return ok({ settlement });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canManageCultSettlements(user.role)) return forbidden();

  const body = await request.json();
  const parsed = cultSettlementSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid settlement");

  const settlement = await upsertCultSettlement(user.gymId, user.id, parsed.data);
  return ok({ settlement });
}
