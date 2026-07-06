import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { decimalToNumber } from "@/lib/utils";
import type { SessionUser } from "@/lib/permissions";
import { ClientListRow } from "@/components/clients/client-list-row";
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

  const canDelete = user.role === "OWNER" || user.role === "TRAINER";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">{clients.length} total clients</p>
        </div>
        {user.role !== "SUPERVISOR" && (
          <Button asChild size="lg" className="min-h-11">
            <Link href={`${basePath}/new`}>+ Add Client</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-3">
        {clients.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No clients yet. Add your first client to get started.
            </CardContent>
          </Card>
        ) : (
          clients.map((client) => {
            const sub = client.subscriptions[0];
            return (
              <ClientListRow
                key={client.id}
                basePath={basePath}
                canDelete={canDelete}
                client={{
                  id: client.id,
                  name: client.name,
                  status: client.status,
                  trainerName: client.trainer.user.name,
                  subEndDate: sub ? sub.endDate.toISOString() : undefined,
                  subAmount: sub ? decimalToNumber(sub.amount) : undefined,
                }}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
