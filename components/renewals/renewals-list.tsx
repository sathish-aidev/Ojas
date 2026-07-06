import { requireOwnerOrSupervisor } from "@/lib/session";
import { getRenewalPipeline, syncSubscriptionStatuses } from "@/lib/services/pt-tracker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency, decimalToNumber } from "@/lib/utils";

export default async function RenewalsPage() {
  const user = await requireOwnerOrSupervisor();
  await syncSubscriptionStatuses(user.gymId);
  const renewals = await getRenewalPipeline(user.gymId, 30);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Renewal Pipeline</h1>
        <p className="text-muted-foreground">Clients due for renewal in the next 30 days</p>
      </div>

      <div className="grid gap-3">
        {renewals.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No renewals due in the next 30 days.
            </CardContent>
          </Card>
        ) : (
          renewals.map((sub) => (
            <Card key={sub.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">{sub.client.name}</CardTitle>
                <Badge variant="warning">{formatDate(sub.endDate)}</Badge>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>Trainer: {sub.client.trainer.user.name}</p>
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
