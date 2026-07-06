import { requireOwner } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { GymSettingsForm } from "@/components/owner/gym-settings-form";

export default async function OwnerSettingsPage() {
  const user = await requireOwner();
  const gym = await prisma.gym.findUniqueOrThrow({ where: { id: user.gymId } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Gym profile and renewal preferences</p>
      </div>
      <GymSettingsForm gym={gym} />
    </div>
  );
}
