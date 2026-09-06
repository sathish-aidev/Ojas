import { Suspense } from "react";
import { requireTrainer } from "@/lib/session";
import { getRenewalPipeline, syncSubscriptionStatuses } from "@/lib/services/pt-tracker";
import { prisma } from "@/lib/prisma";
import { RenewalsTabs } from "@/components/renewals/renewals-tabs";
import { decimalToNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TrainerRenewalsPage() {
  const user = await requireTrainer();
  if (!user.employeeId) {
    return <p className="text-muted-foreground">Trainer profile not found.</p>;
  }

  await syncSubscriptionStatuses(user.gymId);

  const [trainer, renewals] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: user.employeeId },
      include: { user: true },
    }),
    getRenewalPipeline(user.gymId, 30, user.employeeId),
  ]);

  if (!trainer) {
    return <p className="text-muted-foreground">Trainer profile not found.</p>;
  }

  const trainerOptions = [{ id: trainer.id, name: trainer.user.name }];
  const renewalsByTrainer: Record<
    string,
    Array<{
      id: string;
      startDate: string;
      endDate: string;
      amount: number;
      client: { id: string; name: string; phone: string | null };
    }>
  > = { [trainer.id]: [] };

  for (const sub of renewals) {
    renewalsByTrainer[trainer.id].push({
      id: sub.id,
      startDate: sub.startDate.toISOString(),
      endDate: sub.endDate.toISOString(),
      amount: decimalToNumber(sub.amount),
      client: {
        id: sub.client.id,
        name: sub.client.name,
        phone: sub.client.phone,
      },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Renewal Pipeline</h1>
        <p className="text-muted-foreground">
          Your clients due for renewal in the next 30 days. Open a client to log a new PT pack.
        </p>
      </div>

      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <RenewalsTabs
          trainers={trainerOptions}
          renewalsByTrainer={renewalsByTrainer}
          selectedTrainerId={trainer.id}
          clientsBasePath="/trainer/clients"
        />
      </Suspense>
    </div>
  );
}
