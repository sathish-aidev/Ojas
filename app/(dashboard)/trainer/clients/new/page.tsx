import { requireTrainer } from "@/lib/session";
import { AddClientWithPTForm } from "@/components/clients/add-client-with-pt-form";

export default async function NewTrainerClientPage() {
  const user = await requireTrainer();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add PT</h1>
        <p className="text-muted-foreground">PT package and payment details</p>
      </div>
      <AddClientWithPTForm
        defaultTrainerId={user.employeeId}
        redirectTo="/trainer/clients"
        alwaysOpen
      />
    </div>
  );
}
