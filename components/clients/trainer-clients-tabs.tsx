"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientListRow } from "@/components/clients/client-list-row";
import { cn } from "@/lib/utils";

export type ClientListItem = {
  id: string;
  name: string;
  status: string;
  trainerName: string;
  subEndDate?: string;
  subAmount?: number;
};

export function TrainerClientsTabs({
  clients,
  activeCount,
  totalCount,
  basePath,
  showAll,
}: {
  clients: ClientListItem[];
  activeCount: number;
  totalCount: number;
  basePath: string;
  showAll: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">
            {activeCount} active · {totalCount} total
          </p>
        </div>
        <Button asChild size="lg" className="min-h-11">
          <Link href={`${basePath}/new`}>+ Add Client</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl border bg-muted/50 p-1">
        <TabButton
          href={basePath}
          label="Active Clients"
          count={activeCount}
          active={!showAll}
        />
        <TabButton
          href={`${basePath}?tab=all`}
          label="All Clients"
          count={totalCount}
          active={showAll}
        />
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {showAll
              ? "No clients yet. Add your first client to get started."
              : "No active clients. Check All Clients for inactive or expired members."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {clients.map((client) => (
            <ClientListRow
              key={client.id}
              basePath={basePath}
              canDelete
              client={client}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-11 flex-col items-center justify-center rounded-lg px-2 py-2 text-center text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span>{label}</span>
      <span className="text-xs opacity-70">{count}</span>
    </Link>
  );
}
