import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDashboardPath } from "@/lib/utils";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import type { SessionUser } from "@/lib/permissions";

/** Load fresh user from DB so gymId/role stay valid after re-seed (JWT may be stale). */
async function resolveSessionUser(userId: string): Promise<SessionUser | null> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { employee: true },
  });
  if (!dbUser?.isActive) return null;

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
    gymId: dbUser.gymId,
    employeeId: dbUser.employee?.id,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return resolveSessionUser(session.user.id);
}

export async function requireAuth(allowedRoles?: UserRole[]) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect(getDashboardPath(user.role));
  }
  return user;
}

export async function requireOwner() {
  return requireAuth(["OWNER"]);
}

export async function requireOwnerOrSupervisor() {
  return requireAuth(["OWNER", "SUPERVISOR"]);
}

export async function requireTrainer() {
  return requireAuth(["TRAINER"]);
}
