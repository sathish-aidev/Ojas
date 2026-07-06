"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/layout/app-logo";
import { ROLE_LABELS, type SessionUser } from "@/lib/permissions";

export function AppHeader({ user }: { user?: SessionUser }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
        <AppLogo size="sm" />
        <div className="flex items-center gap-2">
          {user && (
            <p className="hidden max-w-[10rem] truncate text-xs text-muted-foreground sm:block md:max-w-none">
              {user.name} · {ROLE_LABELS[user.role]}
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 min-w-11"
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
