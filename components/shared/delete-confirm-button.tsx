"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readApiError } from "@/lib/fetch-api";

type DeleteConfirmButtonProps = {
  endpoint: string;
  entityLabel: string;
  redirectTo?: string;
  size?: "sm" | "default" | "lg";
  variant?: "destructive" | "outline" | "ghost";
  className?: string;
  onSuccess?: () => void;
};

export function DeleteConfirmButton({
  endpoint,
  entityLabel,
  redirectTo,
  size = "sm",
  variant = "destructive",
  className,
  onSuccess,
}: DeleteConfirmButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(
      `Delete ${entityLabel}? This action cannot be undone.`
    );
    if (!confirmed) return;

    setLoading(true);
    setError("");

    const res = await fetch(endpoint, { method: "DELETE" });
    setLoading(false);

    if (!res.ok) {
      setError(await readApiError(res, "Delete failed"));
      return;
    }

    onSuccess?.();
    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh();
    }
  }

  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={loading}
        className="gap-1.5"
        onClick={handleDelete}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {loading ? "Deleting..." : "Delete"}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
