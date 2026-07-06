import { requireTrainer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/utils";
import { hasActivePt } from "@/lib/client-pt-status";
import { TrainerClientsTabs } from "@/components/clients/trainer-clients-tabs";

export default async function TrainerClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireTrainer();
  const { tab } = await searchParams;
  const showAll = tab === "all";

  if (!user.employeeId) {
    return <p className="text-muted-foreground">Trainer profile not found.</p>;
  }

  const rows = await prisma.client.findMany({
    where: { gymId: user.gymId, trainerId: user.employeeId },
    include: {
      trainer: { include: { user: true } },
      subscriptions: { orderBy: { endDate: "desc" }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  const allClients = rows.map((client) => {
    const sub = client.subscriptions[0];
    return {
      id: client.id,
      name: client.name,
      status: client.status,
      trainerName: client.trainer.user.name,
      subEndDate: sub ? sub.endDate.toISOString() : undefined,
      subAmount: sub ? decimalToNumber(sub.amount) : undefined,
    };
  });

  const activeClients = allClients.filter((c) => hasActivePt(c.subEndDate));

  return (
    <TrainerClientsTabs
      clients={showAll ? allClients : activeClients}
      activeCount={activeClients.length}
      totalCount={allClients.length}
      basePath="/trainer/clients"
      showAll={showAll}
    />
  );
}
