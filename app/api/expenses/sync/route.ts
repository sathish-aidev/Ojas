import {
  getApiUser,
  unauthorized,
  forbidden,
  badRequest,
  ok,
} from "@/lib/api-utils";
import { canManageExpenses } from "@/lib/permissions";
import { syncExpensesFromSheet } from "@/lib/services/expenses";

export const maxDuration = 60;

export async function POST() {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canManageExpenses(user.role)) return forbidden();

  try {
    const result = await syncExpensesFromSheet(user.gymId, user.id);
    return ok(result);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Expense sheet sync failed");
  }
}
