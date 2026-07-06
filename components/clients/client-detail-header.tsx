"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteConfirmButton } from "@/components/shared/delete-confirm-button";

type ClientDetailHeaderProps = {
  name: string;
  phone: string | null;
  trainerName: string;
  status: string;
  clientId: string;
  backHref: string;
  canDelete: boolean;
};

export function ClientDetailHeader({
  name,
  phone,
  trainerName,
  status,
  clientId,
  backHref,
  canDelete,
}: ClientDetailHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href={backHref}>← Back</Link>
        </Button>
        <h1 className="text-2xl font-bold">{name}</h1>
        <p className="text-muted-foreground">
          {phone ?? "No phone"} · Trainer: {trainerName}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={status === "ACTIVE" ? "success" : "secondary"}>{status}</Badge>
        {canDelete && (
          <DeleteConfirmButton
            endpoint={`/api/clients/${clientId}`}
            entityLabel={name}
            redirectTo={backHref}
          />
        )}
      </div>
    </div>
  );
}
