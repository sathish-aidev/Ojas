"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmButton } from "@/components/shared/delete-confirm-button";
import { formatDate, formatCurrency } from "@/lib/utils";

type ClientListRowProps = {
  client: {
    id: string;
    name: string;
    status: string;
    trainerName: string;
    subEndDate?: string;
    subAmount?: number;
  };
  basePath: string;
  canDelete: boolean;
};

export function ClientListRow({ client, basePath, canDelete }: ClientListRowProps) {
  return (
    <Card className="transition-colors hover:bg-muted/30">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Link href={`${basePath}/${client.id}`} className="flex-1 min-w-0">
            <CardTitle className="text-lg hover:underline">{client.name}</CardTitle>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={client.status === "ACTIVE" ? "success" : "secondary"}>
              {client.status}
            </Badge>
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
        </Link>
      </CardContent>
    </Card>
  );
}
