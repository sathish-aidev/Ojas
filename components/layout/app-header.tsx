"use client";

import { signOut } from "next-auth/react";
import { Dumbbell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/app-config";
import { ROLE_LABELS, type SessionUser } from "@/lib/permissions";

export function AppHeader({ user }: { user?: SessionUser }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">{APP_NAME}</p>
            {user && (
              <p className="text-xs text-muted-foreground">
                {user.name} · {ROLE_LABELS[user.role]}
              </p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
