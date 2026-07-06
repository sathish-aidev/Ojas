"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollapsibleFormCard } from "@/components/ui/collapsible-form-card";
import { readApiError } from "@/lib/fetch-api";

type TrainerOption = { id: string; name: string };

export function CreateUserForm() {
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

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        role: form.get("role"),
        employeeType: form.get("employeeType"),
        baseSalary: form.get("baseSalary"),
        revenueSplitBelowTarget: form.get("revenueSplitBelowTarget"),
        revenueSplitAboveTarget: form.get("revenueSplitAboveTarget"),
        monthlyTarget: form.get("monthlyTarget"),
        phone: form.get("phone"),
      }),
    });

    setLoading(false);
    if (!res.ok) {
      setError(await readApiError(res, "Failed to create user"));
      return;
    }
    setSuccess("Team member created successfully");
    router.refresh();
    (e.target as HTMLFormElement).reset();
  }

  const [role, setRole] = useState("TRAINER");

  return (
    <CollapsibleFormCard title="Add Team Member" buttonLabel="Add Member">
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Temporary Password</Label>
            <Input id="password" name="password" type="password" minLength={6} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="TRAINER">Trainer</option>
              <option value="SUPERVISOR">Supervisor</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="employeeType">Employee Type</Label>
            <select
              id="employeeType"
              name="employeeType"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="TRAINER">Trainer</option>
              <option value="MANAGER">Gym Manager</option>
              <option value="CLEANING">Cleaning Staff</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="baseSalary">Base Salary (₹)</Label>
            <Input id="baseSalary" name="baseSalary" type="number" min={0} defaultValue={0} />
          </div>
          {role === "TRAINER" && (
            <>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="monthlyTarget">Monthly PT Target (₹)</Label>
                <Input id="monthlyTarget" name="monthlyTarget" type="number" min={0} defaultValue={60000} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revenueSplitBelowTarget">Split % — Below Target</Label>
                <Input
                  id="revenueSplitBelowTarget"
                  name="revenueSplitBelowTarget"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={40}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revenueSplitAboveTarget">Split % — Target Met</Label>
                <Input
                  id="revenueSplitAboveTarget"
                  name="revenueSplitAboveTarget"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={45}
                />
              </div>
            </>
          )}
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          {success && <p className="text-sm text-green-600 sm:col-span-2">{success}</p>}
          <Button type="submit" disabled={loading} className="min-h-11 sm:col-span-2">
            {loading ? "Creating..." : "Create Account"}
          </Button>
        </form>
    </CollapsibleFormCard>
  );
}

export function CreateClientForm({
  trainers,
  defaultTrainerId,
  redirectTo,
}: {
  trainers?: TrainerOption[];
  defaultTrainerId?: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        phone: form.get("phone"),
        email: form.get("email"),
        trainerId: form.get("trainerId") || defaultTrainerId,
        joinDate: form.get("joinDate"),
      }),
    });

    setLoading(false);
    if (!res.ok) {
      setError(await readApiError(res, "Failed to create client"));
      return;
    }
    const client = await res.json();
    router.push(`${redirectTo}/${client.id}`);
    router.refresh();
  }

  return (
    <CollapsibleFormCard title="New Client" buttonLabel="Add Client" defaultOpen>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" name="name" required className="min-h-11" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" className="min-h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" className="min-h-11" />
            </div>
          </div>
          {trainers && (
            <div className="space-y-2">
              <Label htmlFor="trainerId">Trainer</Label>
              <select
                id="trainerId"
                name="trainerId"
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
          <div className="space-y-2">
            <Label htmlFor="joinDate">Join Date</Label>
            <Input
              id="joinDate"
              name="joinDate"
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              className="min-h-11"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} size="lg" className="w-full min-h-11">
            {loading ? "Saving..." : "Create Client"}
          </Button>
        </form>
    </CollapsibleFormCard>
  );
}
