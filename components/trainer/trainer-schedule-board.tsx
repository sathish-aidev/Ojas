"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CollapsibleFormCard } from "@/components/ui/collapsible-form-card";
import { formatTime } from "@/lib/utils";

type ActiveClient = { id: string; name: string };

type SlotRow = {
  id: string;
  startAt: string;
  endAt: string;
  isBlocked: boolean;
  label: string | null;
  clientId: string | null;
};

type SessionRow = {
  id: string;
  scheduledAt: string;
  status: string;
  client: { id: string; name: string };
};

type TimelineItem =
  | { kind: "slot"; id: string; startAt: Date; endAt: Date; clientName?: string; label?: string; isBlocked: boolean }
  | { kind: "session"; id: string; startAt: Date; clientName: string; status: string };

export function TrainerScheduleBoard({
  trainerId,
  activeClients,
  slots,
  sessions,
}: {
  trainerId: string;
  activeClients: ActiveClient[];
  slots: SlotRow[];
  sessions: SessionRow[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);

  const clientNameById = useMemo(
    () => new Map(activeClients.map((c) => [c.id, c.name])),
    [activeClients]
  );

  const timeline = useMemo(() => {
    const dayStart = new Date(`${selectedDate}T00:00:00`);
    const dayEnd = new Date(`${selectedDate}T23:59:59`);

    const items: TimelineItem[] = [];

    for (const slot of slots) {
      const startAt = new Date(slot.startAt);
      if (startAt < dayStart || startAt > dayEnd) continue;
      items.push({
        kind: "slot",
        id: slot.id,
        startAt,
        endAt: new Date(slot.endAt),
        clientName: slot.clientId
          ? clientNameById.get(slot.clientId) ?? "Client"
          : undefined,
        label: slot.label ?? undefined,
        isBlocked: slot.isBlocked,
      });
    }

    for (const session of sessions) {
      const startAt = new Date(session.scheduledAt);
      if (startAt < dayStart || startAt > dayEnd) continue;
      items.push({
        kind: "session",
        id: session.id,
        startAt,
        clientName: session.client.name,
        status: session.status,
      });
    }

    return items.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  }, [slots, sessions, selectedDate, clientNameById]);

  async function addSlot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const date = form.get("date") as string;
    const start = form.get("start") as string;
    const end = form.get("end") as string;
    const clientId = (form.get("clientId") as string) || undefined;

    await fetch("/api/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trainerId,
        startAt: `${date}T${start}:00`,
        endAt: `${date}T${end}:00`,
        isBlocked: form.get("isBlocked") === "on",
        label: form.get("label") || undefined,
        clientId,
      }),
    });

    setSelectedDate(date);
    router.refresh();
    (e.target as HTMLFormElement).reset();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Active Clients</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tap a client to view details, or assign them when adding a slot.
          </p>
        </CardHeader>
        <CardContent>
          {activeClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active clients.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeClients.map((client) => (
                <Link
                  key={client.id}
                  href={`/trainer/clients/${client.id}`}
                  className="rounded-full border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  {client.name}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CollapsibleFormCard title="Add Time Slot" buttonLabel="Add Slot">
        <form onSubmit={addSlot} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="slot-client">Client (optional)</Label>
            <select
              id="slot-client"
              name="clientId"
              defaultValue=""
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Open slot — no client</option>
              {activeClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="slot-date">Date</Label>
            <Input
              id="slot-date"
              name="date"
              type="date"
              defaultValue={today}
              required
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slot-label">Label (optional)</Label>
            <Input id="slot-label" name="label" placeholder="e.g. Morning PT" className="min-h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slot-start">Start time</Label>
            <Input id="slot-start" name="start" type="time" defaultValue="06:00" required className="min-h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slot-end">End time</Label>
            <Input id="slot-end" name="end" type="time" defaultValue="07:00" required className="min-h-11" />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="isBlocked" />
            Block slot (unavailable)
          </label>
          <Button type="submit" className="min-h-11 sm:col-span-2">
            Save Slot
          </Button>
        </form>
      </CollapsibleFormCard>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Day Schedule</CardTitle>
            <p className="text-sm text-muted-foreground">Sorted by time</p>
          </div>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="min-h-11 w-full sm:w-auto"
          />
        </CardHeader>
        <CardContent className="space-y-2">
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No slots or sessions on this day. Add a time slot above.
            </p>
          ) : (
            timeline.map((item) => (
              <div
                key={`${item.kind}-${item.id}`}
                className="flex flex-col gap-1 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {formatTime(item.startAt)}
                    {item.kind === "slot" && item.endAt
                      ? ` – ${formatTime(item.endAt)}`
                      : ""}
                    {item.kind === "slot" && item.clientName ? ` · ${item.clientName}` : ""}
                    {item.kind === "session" ? ` · ${item.clientName}` : ""}
                  </p>
                  {item.kind === "slot" && item.label && (
                    <p className="text-muted-foreground">{item.label}</p>
                  )}
                </div>
                {item.kind === "slot" ? (
                  <Badge
                    variant={
                      item.isBlocked ? "destructive" : item.clientName ? "default" : "success"
                    }
                  >
                    {item.isBlocked ? "Blocked" : item.clientName ? "Booked" : "Open"}
                  </Badge>
                ) : (
                  <Badge variant={item.status === "COMPLETED" ? "success" : "secondary"}>
                    {item.status}
                  </Badge>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
