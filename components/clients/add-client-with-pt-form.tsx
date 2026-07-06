"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleFormCard } from "@/components/ui/collapsible-form-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readApiError } from "@/lib/fetch-api";
import { addMonthsToDate } from "@/lib/utils";

type TrainerOption = { id: string; name: string };

const PAYMENT_MODES = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "OTHER", label: "Other" },
] as const;

type AddClientWithPTFormProps = {
  trainers?: TrainerOption[];
  defaultTrainerId?: string;
  redirectTo?: string;
  title?: string;
  submitLabel?: string;
  showSuccessOnDashboard?: boolean;
  /** When true, form is always visible (dedicated new-client page). */
  alwaysOpen?: boolean;
};

export function AddClientWithPTForm({
  trainers,
  defaultTrainerId,
  redirectTo,
  title = "Add Client & PT Payment",
  submitLabel = "Add Client & PT Package",
  showSuccessOnDashboard = false,
  alwaysOpen = false,
}: AddClientWithPTFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [monthsCount, setMonthsCount] = useState(1);
  const [endDate, setEndDate] = useState(addMonthsToDate(today, 1));

  const recalcEndDate = useCallback((start: string, months: number) => {
    if (start && months > 0) {
      setEndDate(addMonthsToDate(start, months));
    }
  }, []);

  function handleStartChange(value: string) {
    setStartDate(value);
    recalcEndDate(value, monthsCount);
  }

  function handleMonthsChange(value: number) {
    setMonthsCount(value);
    recalcEndDate(startDate, value);
  }

  const isTrainerSelf = !trainers && !!defaultTrainerId;
  const trainerRequired = !isTrainerSelf && (!trainers || trainers.length === 0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const form = new FormData(e.currentTarget);
    form.set("startDate", startDate);
    form.set("endDate", endDate);
    form.set("monthsCount", String(monthsCount));
    if (defaultTrainerId && !form.get("trainerId")) {
      form.set("trainerId", defaultTrainerId);
    }

    const res = await fetch("/api/clients", {
      method: "POST",
      body: form,
    });

    setLoading(false);
    if (!res.ok) {
      setError(await readApiError(res, "Failed to add client"));
      return;
    }

    const client = await res.json();
    if (redirectTo) {
      router.push(`${redirectTo}/${client.id}`);
      router.refresh();
    } else if (showSuccessOnDashboard) {
      setSuccess(`${client.name} added with PT package`);
      router.refresh();
      (e.target as HTMLFormElement).reset();
      setStartDate(today);
      setMonthsCount(1);
      setEndDate(addMonthsToDate(today, 1));
    } else {
      router.refresh();
    }
  }

  const formBody = (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="client-name">Client Name *</Label>
            <Input id="client-name" name="name" required className="min-h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-phone">Phone</Label>
            <Input id="client-phone" name="phone" type="tel" className="min-h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-email">Email</Label>
            <Input id="client-email" name="email" type="email" className="min-h-11" />
          </div>

          {trainers && trainers.length > 0 && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="client-trainer">Assigned Trainer *</Label>
              <select
                id="client-trainer"
                name="trainerId"
                required
                defaultValue={defaultTrainerId}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isTrainerSelf && (
            <input type="hidden" name="trainerId" value={defaultTrainerId} />
          )}

          <div className="sm:col-span-2 border-t pt-4">
            <p className="mb-1 text-sm font-medium">PT Package & Payment</p>
            <p className="text-xs text-muted-foreground">
              Total amount is split evenly across months. Each month&apos;s share counts toward
              that month&apos;s trainer target (40% below target, 45% if met). Trainer share is
              payable the following month. Dates shown as DD/MM/YYYY.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pt-amount">Amount Paid (₹) *</Label>
            <Input id="pt-amount" name="amount" type="number" min={1} required className="min-h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pt-payment-date">Payment Date *</Label>
            <Input
              id="pt-payment-date"
              name="paymentDate"
              type="date"
              defaultValue={today}
              required
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pt-start">Start Date *</Label>
            <Input
              id="pt-start"
              name="startDate"
              type="date"
              value={startDate}
              onChange={(e) => handleStartChange(e.target.value)}
              required
              className="min-h-11"
            />
            <p className="text-xs text-muted-foreground">Format: DD/MM/YYYY</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pt-months">Number of Months *</Label>
            <Input
              id="pt-months"
              name="monthsCount"
              type="number"
              min={1}
              max={36}
              value={monthsCount}
              onChange={(e) => handleMonthsChange(parseInt(e.target.value, 10) || 1)}
              required
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pt-end">End Date *</Label>
            <Input
              id="pt-end"
              name="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment-mode">Mode of Payment</Label>
            <select
              id="payment-mode"
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
            <Label htmlFor="pt-sessions">Sessions Included (optional)</Label>
            <Input id="pt-sessions" name="sessionsTotal" type="number" min={1} className="min-h-11" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="payment-proof">Payment Screenshot (optional)</Label>
            <Input
              id="payment-proof"
              name="proof"
              type="file"
              accept="image/*"
              className="min-h-11"
            />
            <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP — max 5 MB</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-join">Join Date</Label>
            <Input id="client-join" name="joinDate" type="date" defaultValue={today} className="min-h-11" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="pt-notes">Notes</Label>
            <Input id="pt-notes" name="ptNotes" placeholder="Package type, renewal notes..." />
          </div>

          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          {success && <p className="text-sm text-emerald-600 sm:col-span-2">{success}</p>}
          <Button
            type="submit"
            disabled={loading || trainerRequired}
            className="sm:col-span-2 min-h-11"
            size="lg"
          >
            {loading ? "Saving..." : submitLabel}
          </Button>
        </form>
  );

  return alwaysOpen ? (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>{formBody}</CardContent>
    </Card>
  ) : (
    <CollapsibleFormCard title={title} buttonLabel="Add Client">
      {formBody}
    </CollapsibleFormCard>
  );
}
