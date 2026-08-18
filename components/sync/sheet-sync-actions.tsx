"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function SheetSyncActions({
  compact = false,
  showBackup = false,
}: {
  compact?: boolean;
  showBackup?: boolean;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function syncNow() {
    if (!compact && !confirm("Pull latest PT data from Google Sheets and update the app?")) return;
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sync/google-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "MANUAL" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Sync failed");
      } else {
        const s = data.summary;
        setMessage(
          `Sync ${s.status}: ${s.totalCreated} created, ${s.totalUpdated} updated` +
            (s.totalErrors ? `, ${s.totalErrors} errors` : "")
        );
      }
      router.refresh();
    } catch {
      setMessage("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function backupNow() {
    if (!confirm("Create a backup of the PT tracker sheet now?")) return;
    setBackingUp(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sync/backup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Backup failed");
      } else if (data.driveError) {
        setMessage(
          `Backup ${data.status}: DB snapshot saved, but Drive/Sheets copy failed.\n${data.driveError}`
        );
      } else if (data.method === "xlsx_export") {
        setMessage(`Backup OK (Excel in Drive folder)\n${data.fileUrl ?? data.folderUrl ?? ""}`);
      } else if (data.method === "sheet_tabs") {
        setMessage(
          `Backup OK (sheet tabs): ${(data.tabNames ?? []).join(", ")}\n${data.fileUrl ?? ""}`
        );
      } else {
        setMessage(
          `Backup OK (Drive copy): ${data.folderName ?? ""}\n${data.fileUrl ?? data.folderUrl ?? ""}`
        );
      }
      router.refresh();
    } catch {
      setMessage("Backup failed");
    } finally {
      setBackingUp(false);
    }
  }

  return (
    <div className={compact ? "flex items-center gap-2" : "space-y-2"}>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={compact ? "outline" : "default"}
          size={compact ? "sm" : "default"}
          onClick={syncNow}
          disabled={syncing || backingUp}
          className={compact ? "min-h-11" : "min-h-11"}
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : compact ? "Sync sheets" : "Sync from Google Sheets"}
        </Button>
        {showBackup && (
          <Button
            type="button"
            variant="outline"
            size={compact ? "sm" : "default"}
            onClick={backupNow}
            disabled={syncing || backingUp}
            className="min-h-11"
          >
            {backingUp ? "Backing up…" : "Run sheet backup"}
          </Button>
        )}
      </div>
      {message && !compact && (
        <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{message}</pre>
      )}
      {message && compact && (
        <span className="hidden max-w-[12rem] truncate text-xs text-muted-foreground lg:inline">
          {message}
        </span>
      )}
    </div>
  );
}
