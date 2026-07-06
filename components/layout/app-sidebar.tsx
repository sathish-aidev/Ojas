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
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

function getNavItems(role?: UserRole): NavItem[] {
  switch (role) {
    case "OWNER":
      return [
        { href: "/owner", label: "Dashboard", icon: LayoutDashboard },
        { href: "/owner/trainers", label: "Trainers", icon: Users },
        { href: "/owner/clients", label: "Clients", icon: UserCircle },
        { href: "/owner/renewals", label: "Renewals", icon: ClipboardList },
        { href: "/owner/reports", label: "PT Reports", icon: FileBarChart },
        { href: "/owner/salaries", label: "Salaries", icon: DollarSign },
        { href: "/owner/settings", label: "Settings", icon: Settings },
      ];
    case "SUPERVISOR":
      return [
        { href: "/supervisor", label: "Dashboard", icon: LayoutDashboard },
        { href: "/supervisor/trainers", label: "Trainers", icon: Users },
        { href: "/supervisor/clients", label: "Clients", icon: UserCircle },
        { href: "/supervisor/renewals", label: "Renewals", icon: ClipboardList },
        { href: "/supervisor/reports", label: "PT Reports", icon: FileBarChart },
        { href: "/supervisor/salaries", label: "Salaries", icon: DollarSign },
      ];
    case "TRAINER":
      return [
        { href: "/trainer", label: "Today", icon: LayoutDashboard },
        { href: "/trainer/clients", label: "Clients", icon: Users },
        { href: "/trainer/schedule", label: "Schedule", icon: Calendar },
        { href: "/trainer/earnings", label: "Earnings", icon: TrendingUp },
      ];
    default:
      return [];
  }
}

export function AppSidebar({ role }: { role?: UserRole }) {
  const pathname = usePathname();
  const items = getNavItems(role);

  return (
    <aside className="hidden w-56 shrink-0 md:block">
      <nav className="flex flex-col gap-1 rounded-xl border bg-card p-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
