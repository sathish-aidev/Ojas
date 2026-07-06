"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  DollarSign,
  Settings,
  UserCircle,
  TrendingUp,
  FileBarChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

function getNavItems(role?: UserRole): NavItem[] {
  switch (role) {
    case "OWNER":
      return [
        { href: "/owner", label: "Home", icon: LayoutDashboard },
        { href: "/owner/clients", label: "Clients", icon: UserCircle },
        { href: "/owner/trainers", label: "Team", icon: Users },
        { href: "/owner/salaries", label: "Pay", icon: DollarSign },
        { href: "/owner/settings", label: "Settings", icon: Settings },
      ];
    case "SUPERVISOR":
      return [
        { href: "/supervisor", label: "Home", icon: LayoutDashboard },
        { href: "/supervisor/clients", label: "Clients", icon: UserCircle },
        { href: "/supervisor/trainers", label: "Team", icon: Users },
        { href: "/supervisor/reports", label: "Reports", icon: FileBarChart },
        { href: "/supervisor/salaries", label: "Pay", icon: DollarSign },
      ];
    case "TRAINER":
      return [
        { href: "/trainer", label: "Today", icon: LayoutDashboard },
        { href: "/trainer/clients", label: "Clients", icon: Users },
        { href: "/trainer/clients/new", label: "Add", icon: UserCircle },
        { href: "/trainer/schedule", label: "Schedule", icon: Calendar },
        { href: "/trainer/earnings", label: "Pay", icon: TrendingUp },
      ];
    default:
      return [];
  }
}

export function MobileBottomNav({ role }: { role?: UserRole }) {
  const pathname = usePathname();
  const items = getNavItems(role);

  if (items.length === 0) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 py-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/trainer/clients/new" &&
              pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-14 min-w-[4rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[10px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
