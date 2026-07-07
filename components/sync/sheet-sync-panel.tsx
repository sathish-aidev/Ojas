"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SyncRun = {
  id: string;
  status: string;
  source: string;
  createdAt: string;
  summary: {
    totalCreated?: number;
    totalUpdated?: number;
    totalErrors?: number;
    tabs?: Array<{ tabName: string; created: number; updated: number; errors: string[] }>;
  };
};

export function SheetSyncPanel({
  runs,
  canRestore,
}: {
  runs: SyncRun[];
  canRestore: boolean;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function syncNow() {
    if (!confirm("Pull latest PT data from Google Sheets and update the app?")) return;
    setSyncing(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/sync/google-sheets", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setLastResult(data.error ?? "Sync failed");
      } else {
        const s = data.summary;
        setLastResult(
          `Sync ${s.status}: ${s.totalCreated} created, ${s.totalUpdated} updated` +
            (s.totalErrors ? `, ${s.totalErrors} errors` : "")
        );
      }
      router.refresh();
    } catch {
      setLastResult("Sync failed — check Google credentials");
    } finally {
      setSyncing(false);
    }
  }

  async function restore(syncRunId: string) {
    if (!confirm("Restore app data from this snapshot? Current sheet data will be reapplied.")) {
      return;
    }
    setRestoringId(syncRunId);
    try {
      await fetch("/api/sync/google-sheets/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncRunId }),
      });
      router.refresh();
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Google Sheets Sync</CardTitle>
        <CardDescription>
          Pull latest PT data from Rohith, Sai Karan, and Rahul tabs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={syncNow} disabled={syncing} className="min-h-11">
          {syncing ? "Syncing…" : "Sync from Google Sheets"}
        </Button>
        {lastResult && <p className="text-sm text-muted-foreground">{lastResult}</p>}

        {runs.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Recent syncs</p>
            {runs.slice(0, 5).map((run) => (
              <div
                key={run.id}
                className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={run.status === "SUCCESS" ? "success" : "warning"}>
                      {run.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(run.createdAt).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    +{run.summary.totalCreated ?? 0} / ~{run.summary.totalUpdated ?? 0} updated
                    {(run.summary.totalErrors ?? 0) > 0 &&
                      ` · ${run.summary.totalErrors} errors`}
                  </p>
                </div>
                {canRestore && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={restoringId === run.id}
                    onClick={() => restore(run.id)}
                  >
                    {restoringId === run.id ? "Restoring…" : "Restore"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
