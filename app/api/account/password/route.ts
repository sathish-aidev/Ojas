import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { changePasswordSchema } from "@/lib/validations";
import {
  badRequest,
  ok,
  requireGymUser,
  handlePrismaError,
} from "@/lib/api-utils";

export async function POST(request: Request) {
  try {
    const authResult = await requireGymUser();
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) return badRequest("Account not found");

    const valid = await bcrypt.compare(parsed.data.currentPassword, dbUser.passwordHash);
    if (!valid) return badRequest("Current password is incorrect");

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    return ok({ success: true });
  } catch (error) {
    return handlePrismaError(error);
  }
}
