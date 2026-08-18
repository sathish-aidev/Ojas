import { requireOwner } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getSheetSyncRuns } from "@/lib/services/sheet-sync";
import { GymSettingsForm } from "@/components/owner/gym-settings-form";
import { SheetSyncPanel } from "@/components/sync/sheet-sync-panel";

export default async function OwnerSettingsPage() {
  const user = await requireOwner();
  const [gym, syncRuns] = await Promise.all([
    prisma.gym.findUniqueOrThrow({ where: { id: user.gymId } }),
    getSheetSyncRuns(user.gymId, 10),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Gym profile, sheet sync, and backups</p>
      </div>
      <GymSettingsForm gym={gym} />
      <SheetSyncPanel
        runs={syncRuns.map((r) => ({
          id: r.id,
          status: r.status,
          source: r.source,
          createdAt: r.createdAt.toISOString(),
          summary: r.summary as {
            totalCreated?: number;
            totalUpdated?: number;
            totalErrors?: number;
            type?: string;
            method?: string;
            fileUrl?: string | null;
            folderUrl?: string;
            driveError?: string | null;
            tabNames?: string[];
            tabs?: Array<{
              tabName: string;
              created: number;
              updated: number;
              errors: string[];
            }>;
          },
        }))}
        canRestore
      />
    </div>
  );
}
