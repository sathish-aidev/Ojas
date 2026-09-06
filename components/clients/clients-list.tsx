import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { decimalToNumber } from "@/lib/utils";
import { canManageClients, type SessionUser } from "@/lib/permissions";
import { ClientListRow } from "@/components/clients/client-list-row";
import { partitionClientsByActivePt } from "@/lib/client-pt-status";
import Link from "next/link";

export async function ClientsListView({
  user,
  basePath,
}: {
  user: SessionUser;
  basePath: string;
}) {
  const clients = await prisma.client.findMany({
    where: {
      gymId: user.gymId,
      ...(user.role === "TRAINER" && user.employeeId ? { trainerId: user.employeeId } : {}),
    },
    include: {
      trainer: { include: { user: true } },
      subscriptions: { orderBy: { endDate: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  const mapped = clients.map((client) => {
    const sub = client.subscriptions[0];
    return {
      id: client.id,
      name: client.name,
      trainerName: client.trainer.user.name,
      subEndDate: sub ? sub.endDate.toISOString() : undefined,
      subAmount: sub ? decimalToNumber(sub.amount) : undefined,
    };
  });

  const { active, past } = partitionClientsByActivePt(mapped);
  const canManage = canManageClients(user.role);
  const canDelete = user.role === "TRAINER";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">
            {active.length} active PT · {past.length} past · {mapped.length} total
          </p>
        </div>
        {canManage && (
          <Button asChild size="lg" className="min-h-11 w-full sm:w-auto">
            <Link href={`${basePath}/new`}>+ Add PT</Link>
          </Button>
        )}
      </div>

      <ClientSection
        title="Active PT"
        description="Pack still running"
        empty="No active PT right now."
        clients={active}
        basePath={basePath}
        canDelete={canDelete}
      />

      <ClientSection
        title="Past clients"
        description="PT ended — kept for history"
        empty="No past clients yet."
        clients={past}
        basePath={basePath}
        canDelete={canDelete}
      />
    </div>
  );
}

function ClientSection({
  title,
  description,
  empty,
  clients,
  basePath,
  canDelete,
}: {
  title: string;
  description: string;
  empty: string;
  clients: Array<{
    id: string;
    name: string;
    trainerName: string;
    subEndDate?: string;
    subAmount?: number;
  }>;
  basePath: string;
  canDelete: boolean;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">
          {title}{" "}
          <span className="text-sm font-normal text-muted-foreground">({clients.length})</span>
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">{empty}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {clients.map((client) => (
            <ClientListRow
              key={client.id}
              basePath={basePath}
              canDelete={canDelete}
              client={client}
            />
          ))}
        </div>
      )}
    </section>
  );
}
