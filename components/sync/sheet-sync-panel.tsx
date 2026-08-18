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
  const [backingUp, setBackingUp] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

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
        const errorLines =
          s.tabs
            ?.flatMap((tab: { tabName: string; errors: string[] }) =>
              tab.errors.map((err: string) => `${tab.tabName}: ${err}`)
            )
            .slice(0, 5) ?? [];
        setLastResult(
          `Sync ${s.status}: ${s.totalCreated} created, ${s.totalUpdated} updated` +
            (s.totalErrors ? `, ${s.totalErrors} errors` : "") +
            (errorLines.length ? `\n${errorLines.join("\n")}` : "")
        );
      }
      router.refresh();
    } catch {
      setLastResult(
        "Sync failed — check GOOGLE_SERVICE_ACCOUNT_JSON in Vercel environment variables"
      );
    } finally {
      setSyncing(false);
    }
  }

  async function backupNow() {
    if (!confirm("Create a weekly backup of the PT tracker sheet now?")) return;
    setBackingUp(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/sync/backup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setLastResult(data.error ?? "Backup failed");
      } else if (data.driveError) {
        setLastResult(
          `Backup ${data.status}: DB snapshot saved, but Drive/Sheets copy failed.\n${data.driveError}`
        );
      } else if (data.method === "xlsx_export") {
        setLastResult(
          `Backup OK (Excel in Drive folder): ${data.folderName ?? ""}\n${data.fileUrl ?? data.folderUrl ?? ""}`
        );
      } else if (data.method === "sheet_tabs") {
        setLastResult(
          `Backup OK (sheet tabs): ${(data.tabNames ?? []).join(", ")}\n${data.fileUrl ?? ""}`
        );
      } else {
        setLastResult(
          `Backup OK (Drive copy): ${data.folderName ?? ""}\n${data.fileUrl ?? data.folderUrl ?? ""}`
        );
      }
      router.refresh();
    } catch {
      setLastResult("Backup failed — check Google credentials in Vercel env vars");
    } finally {
      setBackingUp(false);
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
          Sheet changes do not appear automatically. Use Sync sheets in the header after editing
          trainer tabs. Full backup history is on Settings (owner) or Salaries (supervisor).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={syncNow} disabled={syncing || backingUp} className="min-h-11">
            {syncing ? "Syncing…" : "Sync from Google Sheets"}
          </Button>
          <Button
            variant="outline"
            onClick={backupNow}
            disabled={syncing || backingUp}
            className="min-h-11"
          >
            {backingUp ? "Backing up…" : "Run sheet backup"}
          </Button>
        </div>
        {lastResult && (
          <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm text-muted-foreground">
            {lastResult}
          </pre>
        )}

        {runs.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Recent syncs & backups</p>
            {runs.slice(0, 8).map((run) => {
              const isBackup = run.source === "BACKUP" || run.summary.type === "weekly_backup";
              const tabErrors =
                run.summary.tabs?.flatMap((tab) =>
                  tab.errors.map((err) => `${tab.tabName}: ${err}`)
                ) ?? [];
              const expanded = expandedRunId === run.id;

              return (
                <div key={run.id} className="rounded-md border p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={run.status === "SUCCESS" ? "success" : "warning"}>
                          {run.status}
                        </Badge>
                        {isBackup && <Badge variant="secondary">Backup</Badge>}
                        <span className="text-sm text-muted-foreground">
                          {new Date(run.createdAt).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {isBackup
                          ? [
                              run.summary.method === "xlsx_export"
                                ? "Excel file in Drive folder"
                                : run.summary.method === "sheet_tabs"
                                ? "Saved as sheet tabs"
                                : run.summary.method === "drive_copy"
                                  ? "Drive file copy"
                                  : "DB snapshot only",
                              run.summary.driveError ? `· ${run.summary.driveError}` : null,
                            ]
                              .filter(Boolean)
                              .join(" ")
                          : `+${run.summary.totalCreated ?? 0} / ~${run.summary.totalUpdated ?? 0} updated${
                              (run.summary.totalErrors ?? 0) > 0
                                ? ` · ${run.summary.totalErrors} errors`
                                : ""
                            }`}
                      </p>
                      {isBackup && run.summary.fileUrl && (
                        <a
                          href={run.summary.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-xs text-primary underline"
                        >
                          Open backup
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {tabErrors.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedRunId(expanded ? null : run.id)}
                        >
                          {expanded ? "Hide errors" : "Show errors"}
                        </Button>
                      )}
                      {canRestore && !isBackup && (
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
                  </div>
                  {expanded && tabErrors.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-destructive">
                      {tabErrors.map((err) => (
                        <li key={err}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
