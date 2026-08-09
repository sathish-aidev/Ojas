import { Suspense } from "react";
import { requireOwnerOrSupervisor } from "@/lib/session";
import { getRenewalPipeline, syncSubscriptionStatuses } from "@/lib/services/pt-tracker";
import { prisma } from "@/lib/prisma";
import { parseTrainerIdFromSearchParams } from "@/lib/parse-search-params";
import { RenewalsTabs } from "@/components/renewals/renewals-tabs";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RenewalsPage({ searchParams }: Props) {
  const user = await requireOwnerOrSupervisor();
  const params = await searchParams;
  await syncSubscriptionStatuses(user.gymId);

  const [trainers, renewals] = await Promise.all([
    prisma.employee.findMany({
      where: { gymId: user.gymId, employeeType: "TRAINER" },
      include: { user: true },
      orderBy: { user: { name: "asc" } },
    }),
    getRenewalPipeline(user.gymId, 30),
  ]);

  const trainerOptions = trainers.map((t) => ({ id: t.id, name: t.user.name }));
  const selectedTrainerId =
    parseTrainerIdFromSearchParams(params) || trainerOptions[0]?.id || "";

  const renewalsByTrainer: Record<string, typeof renewals> = {};
  for (const trainer of trainerOptions) {
    renewalsByTrainer[trainer.id] = [];
  }
  for (const sub of renewals) {
    const trainerId = sub.client.trainerId;
    if (!renewalsByTrainer[trainerId]) renewalsByTrainer[trainerId] = [];
    renewalsByTrainer[trainerId].push(sub);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Renewal Pipeline</h1>
        <p className="text-muted-foreground">
          Clients due for renewal in the next 30 days — grouped by trainer, sorted by recent renewal
        </p>
      </div>

      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <RenewalsTabs
          trainers={trainerOptions}
          renewalsByTrainer={renewalsByTrainer}
          selectedTrainerId={selectedTrainerId}
        />
      </Suspense>
    </div>
  );
}
