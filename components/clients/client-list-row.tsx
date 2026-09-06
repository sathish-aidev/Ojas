"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmButton } from "@/components/shared/delete-confirm-button";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ptListBadge } from "@/lib/client-pt-status";

type ClientListRowProps = {
  client: {
    id: string;
    name: string;
    trainerName: string;
    subEndDate?: string;
    subAmount?: number;
  };
  basePath: string;
  canDelete: boolean;
};

export function ClientListRow({ client, basePath, canDelete }: ClientListRowProps) {
  const badge = ptListBadge(client.subEndDate);
  return (
    <Card className="transition-colors hover:bg-muted/30">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Link href={`${basePath}/${client.id}`} className="min-w-0 flex-1">
            <CardTitle className="text-lg hover:underline">{client.name}</CardTitle>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {canDelete && (
              <DeleteConfirmButton
                endpoint={`/api/clients/${client.id}`}
                entityLabel={client.name}
                variant="outline"
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <Link href={`${basePath}/${client.id}`}>
          <p>Trainer: {client.trainerName}</p>
          {client.subEndDate && client.subAmount !== undefined && (
            <p>
              PT until {formatDate(client.subEndDate)} · {formatCurrency(client.subAmount)}
            </p>
          )}
          {!client.subEndDate && <p>No PT pack on file</p>}
        </Link>
      </CardContent>
    </Card>
  );
}
