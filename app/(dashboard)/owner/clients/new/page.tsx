import { requireOwner } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AddClientWithPTForm } from "@/components/clients/add-client-with-pt-form";

export default async function NewOwnerClientPage() {
  const user = await requireOwner();
  const trainers = await prisma.employee.findMany({
    where: { gymId: user.gymId, employeeType: "TRAINER" },
    include: { user: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Client</h1>
        <p className="text-muted-foreground">Add client with PT package and payment details</p>
      </div>
      <AddClientWithPTForm
        trainers={trainers.map((t) => ({ id: t.id, name: t.user.name }))}
        redirectTo="/owner/clients"
      />
    </div>
  );
}
