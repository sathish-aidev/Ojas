"use client";

import { signOut } from "next-auth/react";
import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/layout/app-logo";
import { ROLE_LABELS, canSyncFromSheets, type SessionUser } from "@/lib/permissions";
import { SheetSyncActions } from "@/components/sync/sheet-sync-actions";

export function AppHeader({ user }: { user?: SessionUser }) {
  const canSync = user ? canSyncFromSheets(user.role) : false;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 md:px-6">
        <AppLogo size="sm" />
        <div className="flex min-w-0 items-center gap-2">
          {canSync && <SheetSyncActions compact />}
          {user && (
            <p className="hidden max-w-[10rem] truncate text-xs text-muted-foreground lg:block">
              {user.name} · {ROLE_LABELS[user.role]}
            </p>
          )}
          {user?.role === "OWNER" && (
            <Button asChild variant="ghost" size="sm" className="min-h-11 min-w-11" aria-label="Settings">
              <Link href="/owner/settings">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Link>
            </Button>
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
