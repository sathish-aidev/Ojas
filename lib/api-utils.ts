import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function getApiUser(): Promise<SessionUser | null> {
  return getSessionUser();
}

export async function requireGymUser(): Promise<
  { user: SessionUser } | { error: NextResponse }
> {
  const user = await getApiUser();
  if (!user) return { error: unauthorized() };

  const gym = await prisma.gym.findUnique({ where: { id: user.gymId } });
  if (!gym) {
    return {
      error: badRequest(
        "Your session is out of date (gym not found). Please sign out and sign in again."
      ),
    };
  }

  return { user };
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message = "Something went wrong. Please try again.") {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function handlePrismaError(error: unknown): NextResponse {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: string }).code;
    if (code === "P2002") {
      return badRequest("Email already in use");
    }
    if (code === "P2003") {
      return badRequest(
        "Session or gym reference is invalid. Sign out and sign in again, then retry."
      );
    }
  }
  console.error(error);
  return serverError();
}
