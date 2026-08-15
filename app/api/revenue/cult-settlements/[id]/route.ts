import {
  getApiUser,
  unauthorized,
  forbidden,
  notFound,
  ok,
} from "@/lib/api-utils";
import { canManageCultSettlements } from "@/lib/permissions";
import { deleteCultSettlement } from "@/lib/services/cult-settlements";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, ctx: Ctx) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canManageCultSettlements(user.role)) return forbidden();

  const { id } = await ctx.params;
  const result = await deleteCultSettlement(user.gymId, id);
  if (!result) return notFound("Settlement not found");
  return ok(result);
}
