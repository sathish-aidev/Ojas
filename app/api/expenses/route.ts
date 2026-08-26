import {
  getApiUser,
  unauthorized,
  forbidden,
  badRequest,
  ok,
  handleExpenseWriteError,
} from "@/lib/api-utils";
import { canManageExpenses } from "@/lib/permissions";
import { gymExpenseSchema } from "@/lib/validations";
import { createExpense, listExpenses } from "@/lib/services/expenses";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canManageExpenses(user.role)) return forbidden();

  const { searchParams } = new URL(request.url);
  const monthRaw = searchParams.get("month");
  const yearRaw = searchParams.get("year");
  const month = monthRaw ? Number(monthRaw) : undefined;
  const year = yearRaw ? Number(yearRaw) : undefined;

  const expenses = await listExpenses(user.gymId, month, year, user.role);
  return ok({ expenses });
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canManageExpenses(user.role)) return forbidden();

  const body = await request.json();
  const parsed = gymExpenseSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid expense");

  try {
    const result = await createExpense(user.gymId, user, parsed.data);
    return ok(result, 201);
  } catch (err) {
    return handleExpenseWriteError(err) ?? badRequest("Could not save expense");
  }
}
