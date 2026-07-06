"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteConfirmButton } from "@/components/shared/delete-confirm-button";

export function UserActions({
  userId,
  userName,
  isActive,
}: {
  userId: string;
  userName: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");

  async function resetPassword() {
    if (password.length < 6) return;
    await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset-password", password }),
    });
    setPassword("");
    router.refresh();
  }

  async function toggleActive() {
    await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle-active" }),
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="h-9 w-40"
      />
      <Button size="sm" variant="outline" onClick={resetPassword}>
        Reset
      </Button>
      <Button size="sm" variant={isActive ? "destructive" : "default"} onClick={toggleActive}>
        {isActive ? "Deactivate" : "Activate"}
      </Button>
      <DeleteConfirmButton
        endpoint={`/api/users/${userId}`}
        entityLabel={userName}
        variant="outline"
      />
    </div>
  );
}
