"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency } from "@/lib/utils";

type RenewalItem = {
  id: string;
  startDate: Date | string;
  endDate: Date | string;
  amount: number;
  client: {
    id: string;
    name: string;
    phone: string | null;
  };
};

type TrainerTab = { id: string; name: string };

export function RenewalsTabs({
  trainers,
  renewalsByTrainer,
  selectedTrainerId,
  clientsBasePath,
}: {
  trainers: TrainerTab[];
  renewalsByTrainer: Record<string, RenewalItem[]>;
  selectedTrainerId: string;
  clientsBasePath: string;
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
              className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
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
              <CardHeader className="flex flex-col gap-2 space-y-0 pb-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-lg leading-tight">{sub.client.name}</CardTitle>
                <Badge variant="warning" className="w-fit">
                  {formatDate(sub.endDate)}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Pack started {formatDate(sub.startDate)}</p>
                <p>Amount: {formatCurrency(sub.amount)}</p>
                {sub.client.phone ? (
                  <p>
                    Phone:{" "}
                    <a className="text-foreground underline" href={`tel:${sub.client.phone}`}>
                      {sub.client.phone}
                    </a>
                  </p>
                ) : (
                  <p>Phone: —</p>
                )}
                <Button asChild className="min-h-11 w-full sm:w-auto">
                  <Link href={`${clientsBasePath}/${sub.client.id}`}>Log renewal</Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
