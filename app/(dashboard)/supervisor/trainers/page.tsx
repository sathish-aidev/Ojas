import { requireOwnerOrSupervisor } from "@/lib/session";
import { getTrainerOverview } from "@/lib/services/pt-tracker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export default async function SupervisorTrainersPage() {
  const user = await requireOwnerOrSupervisor();
  const trainers = await getTrainerOverview(user.gymId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Trainers</h1>
        <p className="text-muted-foreground">View-only trainer overview</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Trainers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trainers.map((t) => (
            <div key={t.id} className="flex justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-sm text-muted-foreground">{t.clientCount} clients</p>
              </div>
              <p className="font-medium">{formatCurrency(t.monthlyRevenue)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
