"use client";

import { signOut } from "next-auth/react";
import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/layout/app-logo";
import { ROLE_LABELS, canSyncFromSheets, type SessionUser } from "@/lib/permissions";
import { SheetSyncActions } from "@/components/sync/sheet-sync-actions";
import { ChangePasswordButton } from "@/components/account/change-password-button";
import { getDashboardPath } from "@/lib/utils";

export function AppHeader({ user }: { user?: SessionUser }) {
  const canSync = user ? canSyncFromSheets(user.role) : false;
  const homeHref = user ? getDashboardPath(user.role) : "/";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-1 px-3 sm:h-16 sm:gap-2 sm:px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <AppLogo size="sm" href={homeHref} className="min-w-0 shrink" />
          {process.env.NEXT_PUBLIC_APP_ENV === "staging" ? (
            <span className="shrink-0 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
              TEST
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          {canSync && <SheetSyncActions compact />}
          {user && (
            <p className="hidden max-w-[10rem] truncate text-xs text-muted-foreground lg:block">
              {user.name} · {ROLE_LABELS[user.role]}
            </p>
          )}
          {user && <ChangePasswordButton />}
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
