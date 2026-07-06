"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { readApiError } from "@/lib/fetch-api";
import { DeleteConfirmButton } from "@/components/shared/delete-confirm-button";
import { TrainerSplitRulesPanel } from "@/components/owner/trainer-split-rules-panel";

export type TrainerRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  monthlyTarget: number | null;
  revenueSplitBelowTarget: number;
  revenueSplitAboveTarget: number;
  activeSplitPercent: number;
  targetMet: boolean;
  hasTarget: boolean;
  baseSalary: number;
  clientCount: number;
  monthlyRevenue: number;
  trainerShare: number;
  ownerShare: number;
};

export function AddTrainerForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    const form = new FormData(e.currentTarget);
    const name = form.get("name") as string;
    const emailInput = (form.get("email") as string)?.trim();
    const email =
      emailInput || `${name.toLowerCase().replace(/\s+/g, ".")}@impackt.gym`;

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password: form.get("password") || "password123",
        role: "TRAINER",
        employeeType: "TRAINER",
        baseSalary: form.get("baseSalary") || 0,
        monthlyTarget: form.get("monthlyTarget") || 0,
        revenueSplitBelowTarget: form.get("revenueSplitBelowTarget") || 40,
        revenueSplitAboveTarget: form.get("revenueSplitAboveTarget") || 45,
        phone: form.get("phone"),
      }),
    });

    setLoading(false);
    if (!res.ok) {
      setError(await readApiError(res, "Failed to add trainer"));
      return;
    }
    setSuccess(`${name} added successfully`);
    router.refresh();
    (e.target as HTMLFormElement).reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Add Trainer</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="trainer-name">Trainer Name *</Label>
            <Input id="trainer-name" name="name" placeholder="e.g. Rohit" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trainer-email">Email (optional)</Label>
            <Input id="trainer-email" name="email" type="email" placeholder="Auto-generated if blank" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trainer-phone">Phone</Label>
            <Input id="trainer-phone" name="phone" type="tel" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="trainer-target">Monthly PT Target (₹)</Label>
            <Input
              id="trainer-target"
              name="monthlyTarget"
              type="number"
              min={0}
              placeholder="e.g. 60000"
              defaultValue={60000}
            />
            <p className="text-xs text-muted-foreground">
              If trainer hits this target in a month, the higher split % applies to all PT that month.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="split-below">Split % — Below Target</Label>
            <Input
              id="split-below"
              name="revenueSplitBelowTarget"
              type="number"
              min={0}
              max={100}
              defaultValue={40}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="split-above">Split % — Target Met</Label>
            <Input
              id="split-above"
              name="revenueSplitAboveTarget"
              type="number"
              min={0}
              max={100}
              defaultValue={45}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trainer-salary">Base Salary (₹/month)</Label>
            <Input id="trainer-salary" name="baseSalary" type="number" min={0} defaultValue={0} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trainer-password">Temp Password</Label>
            <Input
              id="trainer-password"
              name="password"
              type="password"
              defaultValue="password123"
              minLength={6}
            />
          </div>
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          {success && <p className="text-sm text-emerald-600 sm:col-span-2">{success}</p>}
          <Button type="submit" disabled={loading} className="sm:col-span-2">
            {loading ? "Adding..." : "Add Trainer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function TrainerSplitEditor({
  trainers,
  title = "Manage Trainers & Target-Based Splits",
}: {
  trainers: TrainerRow[];
  title?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [expandedRules, setExpandedRules] = useState<string | null>(null);

  async function saveTrainer(trainer: TrainerRow, form: HTMLFormElement) {
    setLoading(true);
    setMessage("");
    const formData = new FormData(form);

    const res = await fetch(`/api/users/${trainer.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update-trainer",
        name: formData.get("name"),
        phone: formData.get("phone"),
        baseSalary: formData.get("baseSalary"),
      }),
    });

    setLoading(false);
    if (!res.ok) {
      setMessage(await readApiError(res, "Update failed"));
      return;
    }
    setMessage("Trainer updated — payment splits recalculated for this month");
    setEditing(null);
    router.refresh();
  }

  if (trainers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No trainers yet. Add one above.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Edit trainer profile and base salary. Use Split Rules for target / % by month.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {trainers.map((trainer) => (
          <div key={trainer.id} className="rounded-lg border p-4">
            {editing === trainer.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveTrainer(trainer, e.currentTarget);
                }}
                className="grid gap-3 sm:grid-cols-2"
              >
                <div className="space-y-2 sm:col-span-2">
                  <Label>Trainer Name</Label>
                  <Input name="name" defaultValue={trainer.name} required />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Phone</Label>
                  <Input name="phone" type="tel" defaultValue={trainer.phone ?? ""} placeholder="Optional" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Base Salary (₹)</Label>
                  <Input name="baseSalary" type="number" min={0} defaultValue={trainer.baseSalary} />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" size="sm" disabled={loading}>
                    {loading ? "Saving..." : "Save Profile"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{trainer.name}</p>
                    {trainer.hasTarget && (
                      <Badge variant={trainer.targetMet ? "success" : "warning"}>
                        {trainer.targetMet ? "Target met" : "Below target"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {trainer.clientCount} clients · {trainer.activeSplitPercent}% active split
                    {trainer.hasTarget && trainer.monthlyTarget
                      ? ` · target ${formatCurrency(trainer.monthlyTarget)}`
                      : ""}{" "}
                    · Base {formatCurrency(trainer.baseSalary)}
                  </p>
                  {trainer.hasTarget && (
                    <p className="text-sm text-muted-foreground">
                      Split rules: {trainer.revenueSplitBelowTarget}% below target /{" "}
                      {trainer.revenueSplitAboveTarget}% when target met
                    </p>
                  )}
                  {trainer.hasTarget && trainer.monthlyTarget && (
                    <p className="text-sm text-muted-foreground">
                      MTD {formatCurrency(trainer.monthlyRevenue)} /{" "}
                      {formatCurrency(trainer.monthlyTarget)} target
                    </p>
                  )}
                  <p className="text-sm">
                    Revenue: {formatCurrency(trainer.monthlyRevenue)} · Trainer{" "}
                    {formatCurrency(trainer.trainerShare)} · Owner{" "}
                    {formatCurrency(trainer.ownerShare)}
                  </p>
                  {trainer.phone && (
                    <p className="text-sm text-muted-foreground">{trainer.phone}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setEditing(trainer.id)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setExpandedRules(expandedRules === trainer.id ? null : trainer.id)
                    }
                  >
                    {expandedRules === trainer.id ? "Hide Rules" : "Split Rules"}
                  </Button>
                  <DeleteConfirmButton
                    endpoint={`/api/users/${trainer.userId}`}
                    entityLabel={trainer.name}
                    variant="outline"
                  />
                </div>
              </div>
            )}
            {expandedRules === trainer.id && editing !== trainer.id && (
              <TrainerSplitRulesPanel employeeId={trainer.id} trainerName={trainer.name} />
            )}
          </div>
        ))}
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  );
}
