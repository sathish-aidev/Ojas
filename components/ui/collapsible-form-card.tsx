"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CollapsibleFormCardProps = {
  title: string;
  description?: string;
  buttonLabel?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function CollapsibleFormCard({
  title,
  description,
  buttonLabel,
  defaultOpen = false,
  children,
}: CollapsibleFormCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {!open ? (
          <Button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-11 shrink-0 gap-1.5"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only sm:inline">{buttonLabel ?? "Add"}</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            className="min-h-11 shrink-0 gap-1"
          >
            <X className="h-4 w-4" />
            Close
          </Button>
        )}
      </CardHeader>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}
