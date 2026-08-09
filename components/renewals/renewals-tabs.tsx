"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency, decimalToNumber } from "@/lib/utils";

type RenewalItem = {
  id: string;
  startDate: Date | string;
  endDate: Date | string;
  amount: { toString(): string };
  client: {
    name: string;
    phone: string | null;
    trainer: { user: { name: string } };
  };
};

type TrainerTab = { id: string; name: string };

export function RenewalsTabs({
  trainers,
  renewalsByTrainer,
  selectedTrainerId,
}: {
  trainers: TrainerTab[];
  renewalsByTrainer: Record<string, RenewalItem[]>;
  selectedTrainerId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selectTrainer(trainerId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("trainer", trainerId);
    router.push(`${pathname}?${params.toString()}`);
  }

  const activeTrainerId = selectedTrainerId || trainers[0]?.id || "";
  const activeRenewals = renewalsByTrainer[activeTrainerId] ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {trainers.map((trainer) => {
          const count = renewalsByTrainer[trainer.id]?.length ?? 0;
          const active = trainer.id === activeTrainerId;
          return (
            <button
              key={trainer.id}
              type="button"
              onClick={() => selectTrainer(trainer.id)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              }`}
            >
              {trainer.name}
              {count > 0 && (
                <span className="ml-2 rounded-full bg-black/10 px-2 py-0.5 text-xs">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3">
        {activeRenewals.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No renewals due for this trainer in the next 30 days.
            </CardContent>
          </Card>
        ) : (
          activeRenewals.map((sub) => (
            <Card key={sub.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">{sub.client.name}</CardTitle>
                <Badge variant="warning">{formatDate(sub.endDate)}</Badge>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>Renewed: {formatDate(sub.startDate)}</p>
                <p>Amount: {formatCurrency(decimalToNumber(sub.amount))}</p>
                <p>Phone: {sub.client.phone ?? "—"}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
