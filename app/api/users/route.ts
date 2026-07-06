import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  getApiUser,
  unauthorized,
  forbidden,
  badRequest,
  ok,
  requireGymUser,
  handlePrismaError,
} from "@/lib/api-utils";
import { canManageUsers } from "@/lib/permissions";
import { createUserSchema } from "@/lib/validations";

export async function GET() {
  const user = await getApiUser();
  if (!user) return unauthorized();
  if (!canManageUsers(user.role)) return forbidden();

  const users = await prisma.user.findMany({
    where: { gymId: user.gymId, role: { not: "OWNER" } },
    include: { employee: true },
    orderBy: { createdAt: "desc" },
  });

  return ok(users);
}

export async function POST(request: Request) {
  try {
    const authResult = await requireGymUser();
    if ("error" in authResult) return authResult.error;
    const { user } = authResult;

    if (!canManageUsers(user.role)) return forbidden();

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");
    }

    const email = parsed.data.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return badRequest("Email already in use");

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const isTrainer = parsed.data.role === "TRAINER";
    const employeeType = isTrainer
      ? parsed.data.employeeType ?? "TRAINER"
      : parsed.data.employeeType ?? "MANAGER";

    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: parsed.data.name.trim(),
        role: parsed.data.role,
        gymId: user.gymId,
        employee: {
          create: {
            gymId: user.gymId,
            employeeType,
            baseSalary: parsed.data.baseSalary ?? 0,
            monthlyTarget: isTrainer ? (parsed.data.monthlyTarget ?? 0) : null,
            revenueSplitBelowTarget: isTrainer
              ? (parsed.data.revenueSplitBelowTarget ?? 40)
              : null,
            revenueSplitAboveTarget: isTrainer
              ? (parsed.data.revenueSplitAboveTarget ?? 45)
              : null,
            phone: parsed.data.phone?.trim() || null,
          },
        },
      },
      include: { employee: true },
    });

    return ok(newUser, 201);
  } catch (error) {
    return handlePrismaError(error);
  }
}
