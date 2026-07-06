"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function GymSettingsForm({
  gym,
}: {
  gym: { name: string; location: string | null; renewalReminderDays: number };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/gym", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        location: form.get("location"),
        renewalReminderDays: form.get("renewalReminderDays"),
      }),
    });
    setLoading(false);
    setMessage(res.ok ? "Settings saved" : "Failed to save");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Gym Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
          <div className="space-y-2">
            <Label htmlFor="name">Gym Name</Label>
            <Input id="name" name="name" defaultValue={gym.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" name="location" defaultValue={gym.location ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="renewalReminderDays">Renewal Reminder (days before end)</Label>
            <Input
              id="renewalReminderDays"
              name="renewalReminderDays"
              type="number"
              min={1}
              max={60}
              defaultValue={gym.renewalReminderDays}
            />
          </div>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
