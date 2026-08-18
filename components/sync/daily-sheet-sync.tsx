"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { todayYmdInTimeZone } from "@/lib/date-ymd";

export function DailySheetSync({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const key = `impackt-pt-daily-sync-${todayYmdInTimeZone("Asia/Kolkata")}`;
    if (sessionStorage.getItem(key)) return;

    let cancelled = false;

    async function run() {
      try {
        const statusRes = await fetch("/api/sync/google-sheets/status");
        if (!statusRes.ok) {
          sessionStorage.setItem(key, "status-failed");
          return;
        }
        const status = await statusRes.json();
        if (!status.needsDailySync) {
          sessionStorage.setItem(key, "skipped");
          return;
        }
        sessionStorage.setItem(key, "started");
        if (!cancelled) setBanner("Syncing today's PT sheet…");
        const res = await fetch("/api/sync/google-sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "DAILY" }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setBanner(data.error ?? "Daily sheet sync failed");
          sessionStorage.setItem(key, "failed");
          return;
        }
        const s = data.summary;
        setBanner(
          `PT sheet synced: ${s.totalCreated} new, ${s.totalUpdated} updated` +
            (s.totalErrors ? `, ${s.totalErrors} errors` : "")
        );
        sessionStorage.setItem(key, "done");
        router.refresh();
        window.setTimeout(() => setBanner(null), 8000);
      } catch {
        if (!cancelled) setBanner("Daily sheet sync failed");
        sessionStorage.setItem(key, "failed");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, router]);

  if (!banner) return null;

  return (
    <div className="border-b bg-muted/60 px-4 py-2 text-center text-xs text-muted-foreground md:px-6">
      {banner}
    </div>
  );
}
