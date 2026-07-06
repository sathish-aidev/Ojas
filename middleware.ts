import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getDashboardPath } from "@/lib/utils";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isPublic = pathname === "/login" || pathname.startsWith("/api/auth");

  if (!isLoggedIn && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && pathname === "/login") {
    return NextResponse.redirect(new URL(getDashboardPath(req.auth!.user.role), req.url));
  }

  if (isLoggedIn && req.auth?.user) {
    const role = req.auth.user.role;
    if (pathname.startsWith("/owner") && role !== "OWNER") {
      return NextResponse.redirect(new URL(getDashboardPath(role), req.url));
    }
    if (pathname.startsWith("/supervisor") && role !== "SUPERVISOR") {
      return NextResponse.redirect(new URL(getDashboardPath(role), req.url));
    }
    if (pathname.startsWith("/trainer") && role !== "TRAINER") {
      return NextResponse.redirect(new URL(getDashboardPath(role), req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads).*)"],
};
