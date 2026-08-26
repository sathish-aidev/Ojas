import {
  getApiUser,
  unauthorized,
  forbidden,
  badRequest,
  notFound,
  ok,
  handleExpenseWriteError,
} from "@/lib/api-utils";
import { canManageExpenses } from "@/lib/permissions";
import { gymExpenseUpdateSchema } from "@/lib/validations";
import { deleteExpense, updateExpense } from "@/lib/services/expenses";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canManageExpenses(user.role)) return forbidden();

  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = gymExpenseUpdateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid expense");

  try {
    const result = await updateExpense(user.gymId, user, id, parsed.data);
    if (!result) return notFound("Expense not found");
    return ok(result);
  } catch (err) {
    return handleExpenseWriteError(err) ?? badRequest("Could not update expense");
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canManageExpenses(user.role)) return forbidden();

  const { id } = await ctx.params;
  try {
    const result = await deleteExpense(user.gymId, user, id);
    if (!result) return notFound("Expense not found");
    return ok(result);
  } catch (err) {
    return handleExpenseWriteError(err) ?? badRequest("Could not delete expense");
  }
}
