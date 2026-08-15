"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { SerializedCultSettlement } from "@/lib/services/cult-settlements";

type Folders = {
  cultInvoicesUrl: string;
  settlementUrl: string;
  taxInvoiceUrl: string;
} | null;

function Field({
  id,
  label,
  name,
  defaultValue,
  type = "number",
  hint,
}: {
  id: string;
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        step={type === "number" ? "0.01" : undefined}
        defaultValue={defaultValue ?? ""}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function CultSettlementForm({
  month,
  year,
  settlement,
  folders,
  folderError,
}: {
  month: number;
  year: number;
  settlement: SerializedCultSettlement | null;
  folders: Folders;
  folderError?: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = { month, year };
    for (const [key, value] of form.entries()) {
      payload[key] = typeof value === "string" ? value : String(value);
    }
    try {
      const res = await fetch("/api/revenue/cult-settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Save failed");
        return;
      }
      setMessage("Cult month saved");
      router.refresh();
    } catch {
      setMessage("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!settlement) return;
    if (!confirm("Delete this month's Cult figures? PDFs in Drive are not deleted.")) return;
    const res = await fetch(`/api/revenue/cult-settlements/${settlement.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error ?? "Delete failed");
      return;
    }
    setMessage("Cult month cleared");
    router.refresh();
  }

  const source = settlement?.cultIncome;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Cult / Curefit settlement</CardTitle>
            <CardDescription>
              Canonical income is Partner Share. If the settlement statement is delayed, enter Tax
              Invoice Gross Total and attach the PDF — it is used until Partner Share is saved.
            </CardDescription>
          </div>
          {source && source.source !== "none" && (
            <Badge variant={source.source === "partner_share" ? "success" : "warning"}>
              Using {source.label}
            </Badge>
          )}
        </div>
        {folders ? (
          <p className="text-sm text-muted-foreground">
            Upload PDFs to{" "}
            <a className="underline" href={folders.settlementUrl} target="_blank" rel="noreferrer">
              Settlement Statements
            </a>
            {" · "}
            <a className="underline" href={folders.taxInvoiceUrl} target="_blank" rel="noreferrer">
              Tax Invoices
            </a>
            , then paste the Drive links below.
          </p>
        ) : folderError ? (
          <p className="text-sm text-muted-foreground">Drive folders: {folderError}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="partnerShare"
              name="partnerShare"
              label="Partner Share (canonical)"
              defaultValue={settlement?.partnerShare}
              hint="Amount payable to gym partner, e.g. 809198"
            />
            <Field
              id="taxInvoiceGrossTotal"
              name="taxInvoiceGrossTotal"
              label="Tax Invoice Gross Total (interim)"
              defaultValue={settlement?.taxInvoiceGrossTotal}
            />
            <Field
              id="periodStart"
              name="periodStart"
              label="Period start"
              type="date"
              defaultValue={settlement?.periodStart}
            />
            <Field
              id="periodEnd"
              name="periodEnd"
              label="Period end"
              type="date"
              defaultValue={settlement?.periodEnd}
            />
            <Field
              id="settlementDriveUrl"
              name="settlementDriveUrl"
              label="Settlement statement Drive URL"
              type="text"
              defaultValue={settlement?.settlementDriveUrl}
            />
            <Field
              id="taxInvoiceDriveUrl"
              name="taxInvoiceDriveUrl"
              label="Tax invoice Drive URL"
              type="text"
              defaultValue={settlement?.taxInvoiceDriveUrl}
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            className="px-0"
            onClick={() => setShowDetails((v) => !v)}
          >
            {showDetails ? "Hide settlement details" : "Show settlement details"}
          </Button>

          {showDetails && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field id="saleOfNewPacks" name="saleOfNewPacks" label="Sale of new packs" defaultValue={settlement?.saleOfNewPacks} />
              <Field id="walkInsOuts" name="walkInsOuts" label="Walk ins / walk outs" defaultValue={settlement?.walkInsOuts} />
              <Field id="otherAdjustments" name="otherAdjustments" label="Other adjustments" defaultValue={settlement?.otherAdjustments} />
              <Field id="platformFees" name="platformFees" label="Platform fees" defaultValue={settlement?.platformFees} />
              <Field id="totalRevenue" name="totalRevenue" label="Cult total revenue" defaultValue={settlement?.totalRevenue} />
              <Field id="cmCharges" name="cmCharges" label="CM charges" defaultValue={settlement?.cmCharges} />
              <Field id="maintInfraCharges" name="maintInfraCharges" label="Maint / infra charges" defaultValue={settlement?.maintInfraCharges} />
              <Field id="centerCollections" name="centerCollections" label="Collected at centre" defaultValue={settlement?.centerCollections} />
              <Field id="midMonthPayment" name="midMonthPayment" label="Mid-month payment" defaultValue={settlement?.midMonthPayment} />
              <Field id="tds" name="tds" label="TDS" defaultValue={settlement?.tds} />
              <Field id="grossPayable" name="grossPayable" label="Gross payable" defaultValue={settlement?.grossPayable} />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="cult-notes">Notes</Label>
            <Textarea id="cult-notes" name="notes" defaultValue={settlement?.notes ?? ""} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving} className="min-h-11">
              {saving ? "Saving…" : "Save Cult month"}
            </Button>
            {settlement && (
              <Button type="button" variant="outline" onClick={remove} className="min-h-11">
                Clear month
              </Button>
            )}
          </div>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
