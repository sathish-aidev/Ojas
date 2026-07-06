"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CollapsibleFormCard } from "@/components/ui/collapsible-form-card";
import { readApiError } from "@/lib/fetch-api";
import { addMonthsToDate } from "@/lib/utils";

const PAYMENT_MODES = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "OTHER", label: "Other" },
] as const;

export function AddSubscriptionForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [monthsCount, setMonthsCount] = useState(1);
  const [endDate, setEndDate] = useState(addMonthsToDate(today, 1));

  const recalcEndDate = useCallback((start: string, months: number) => {
    if (start && months > 0) setEndDate(addMonthsToDate(start, months));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    form.set("clientId", clientId);
    form.set("startDate", startDate);
    form.set("endDate", endDate);
    form.set("monthsCount", String(monthsCount));

    const res = await fetch("/api/subscriptions", { method: "POST", body: form });
    setLoading(false);
    if (!res.ok) {
      setError(await readApiError(res, "Failed to save payment"));
      return;
    }
    router.refresh();
    (e.target as HTMLFormElement).reset();
    setStartDate(today);
    setMonthsCount(1);
    setEndDate(addMonthsToDate(today, 1));
  }

  return (
    <CollapsibleFormCard title="Log PT Payment" buttonLabel="Log Payment">
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Amount Paid (₹)</Label>
            <Input name="amount" type="number" min={1} required className="min-h-11" />
          </div>
          <div className="space-y-2">
            <Label>Payment Date</Label>
            <Input name="paymentDate" type="date" defaultValue={today} required className="min-h-11" />
          </div>
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input
              name="startDate"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                recalcEndDate(e.target.value, monthsCount);
              }}
              required
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label>Number of Months</Label>
            <Input
              name="monthsCount"
              type="number"
              min={1}
              max={36}
              value={monthsCount}
              onChange={(e) => {
                const m = parseInt(e.target.value, 10) || 1;
                setMonthsCount(m);
                recalcEndDate(startDate, m);
              }}
              required
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input
              name="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label>Mode of Payment</Label>
            <select
              name="paymentMode"
              defaultValue="CASH"
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Sessions (optional)</Label>
            <Input name="sessionsTotal" type="number" min={1} className="min-h-11" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Payment Screenshot (optional)</Label>
            <Input name="proof" type="file" accept="image/*" className="min-h-11" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea name="notes" rows={2} />
          </div>
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          <Button type="submit" disabled={loading} className="min-h-11 sm:col-span-2">
            {loading ? "Saving..." : "Save Payment & Subscription"}
          </Button>
        </form>
    </CollapsibleFormCard>
  );
}

export function AddSessionForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const scheduledAt = `${form.get("date")}T${form.get("time")}:00`;

    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        scheduledAt,
        status: form.get("status"),
        startTime: form.get("logStart") === "on" ? scheduledAt : undefined,
        notes: form.get("notes"),
      }),
    });
    setLoading(false);
    router.refresh();
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <CollapsibleFormCard title="Schedule / Log Session" buttonLabel="Add Session">
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input name="date" type="date" defaultValue={today} required className="min-h-11" />
          </div>
          <div className="space-y-2">
            <Label>Time</Label>
            <Input name="time" type="time" defaultValue="07:00" required className="min-h-11" />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <select name="status" className="flex h-11 w-full rounded-md border px-3 text-sm">
              <option value="SCHEDULED">Scheduled</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No Show</option>
            </select>
          </div>
          <div className="flex items-end gap-2 pb-2">
            <input type="checkbox" id="logStart" name="logStart" />
            <Label htmlFor="logStart">Log start time now</Label>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea name="notes" rows={2} />
          </div>
          <Button type="submit" disabled={loading} className="min-h-11 sm:col-span-2">
            {loading ? "Saving..." : "Save Session"}
          </Button>
        </form>
    </CollapsibleFormCard>
  );
}

export function ProgressForms({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<"goal" | "measurement" | "note" | "diet">("note");

  async function submit(type: string, data: Record<string, unknown>) {
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, clientId, ...data }),
    });
    router.refresh();
  }

  return (
    <CollapsibleFormCard title="Track Progress" buttonLabel="Track Progress">
        <div className="mb-4 flex flex-wrap gap-2">
          {(["note", "goal", "measurement", "diet"] as const).map((t) => (
            <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => setTab(t)} className="min-h-10">
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Button>
          ))}
        </div>
        {tab === "note" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              submit("note", {
                content: form.get("content"),
                isPinned: form.get("isPinned") === "on",
              });
              (e.target as HTMLFormElement).reset();
            }}
            className="space-y-3"
          >
            <Textarea name="content" placeholder="Client limitations, injuries, reminders..." required />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isPinned" defaultChecked />
              Pin to top of client profile
            </label>
            <Button type="submit" className="min-h-11">Save Note</Button>
          </form>
        )}
        {tab === "goal" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              submit("goal", {
                goalType: form.get("goalType"),
                title: form.get("title"),
                targetValue: form.get("targetValue"),
                currentValue: form.get("currentValue"),
                unit: form.get("unit"),
                deadline: form.get("deadline"),
              });
              (e.target as HTMLFormElement).reset();
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <Input name="title" placeholder="Goal title" required className="sm:col-span-2 min-h-11" />
            <select name="goalType" className="h-11 rounded-md border px-3 text-sm">
              <option value="WEIGHT_LOSS">Weight Loss</option>
              <option value="FITNESS">Fitness</option>
              <option value="MUSCLE_GAIN">Muscle Gain</option>
              <option value="CUSTOM">Custom</option>
            </select>
            <Input name="unit" placeholder="Unit (kg, %)" className="min-h-11" />
            <Input name="currentValue" type="number" step="0.1" placeholder="Current" className="min-h-11" />
            <Input name="targetValue" type="number" step="0.1" placeholder="Target" className="min-h-11" />
            <Input name="deadline" type="date" className="sm:col-span-2 min-h-11" />
            <Button type="submit" className="sm:col-span-2 min-h-11">Add Goal</Button>
          </form>
        )}
        {tab === "measurement" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              submit("measurement", {
                type: form.get("type"),
                value: form.get("value"),
                unit: form.get("unit"),
                frequency: form.get("frequency"),
                recordedAt: form.get("recordedAt"),
              });
              (e.target as HTMLFormElement).reset();
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <select name="type" className="h-11 rounded-md border px-3 text-sm">
              {["WEIGHT", "BODY_FAT", "CHEST", "WAIST", "HIPS", "BICEPS", "THIGHS"].map((t) => (
                <option key={t} value={t}>{t.replace("_", " ")}</option>
              ))}
            </select>
            <Input name="value" type="number" step="0.1" placeholder="Value" required className="min-h-11" />
            <Input name="unit" defaultValue="kg" className="min-h-11" />
            <select name="frequency" className="h-11 rounded-md border px-3 text-sm">
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Bi-weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
            <Input name="recordedAt" type="date" defaultValue={new Date().toISOString().split("T")[0]} className="sm:col-span-2 min-h-11" />
            <Button type="submit" className="sm:col-span-2 min-h-11">Add Measurement</Button>
          </form>
        )}
        {tab === "diet" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              submit("diet", {
                title: form.get("title"),
                content: form.get("content"),
                adherenceNotes: form.get("adherenceNotes"),
              });
              (e.target as HTMLFormElement).reset();
            }}
            className="space-y-3"
          >
            <Input name="title" placeholder="Program title" required className="min-h-11" />
            <Textarea name="content" placeholder="Meal plan details..." required rows={4} />
            <Textarea name="adherenceNotes" placeholder="How is the client doing?" rows={2} />
            <Button type="submit" className="min-h-11">Save Diet Program</Button>
          </form>
        )}
    </CollapsibleFormCard>
  );
}

export function PhotoUploadForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    form.set("type", "photo");
    form.set("clientId", clientId);
    await fetch("/api/progress", { method: "POST", body: form });
    setLoading(false);
    router.refresh();
    (e.target as HTMLFormElement).reset();
  }

  return (
    <CollapsibleFormCard title="Progress Photo (Optional)" buttonLabel="Add Photo">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input name="file" type="file" accept="image/*" required className="min-h-11" />
          <Input name="caption" placeholder="Caption" className="min-h-11" />
          <Button type="submit" disabled={loading} variant="outline" className="min-h-11 w-full sm:w-auto">
            {loading ? "Uploading..." : "Upload Photo"}
          </Button>
        </form>
    </CollapsibleFormCard>
  );
}
