"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { SerializedCultSettlement } from "@/lib/services/cult-settlements";
import type { CultDriveFile } from "@/lib/google/cult-invoices";
import { getMonthName } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";

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

function FileRow({
  file,
  onAttach,
  attaching,
}: {
  file: CultDriveFile;
  onAttach?: (file: CultDriveFile, kind?: CultDriveFile["kind"]) => void;
  attaching?: boolean;
}) {
  const monthLabel =
    file.month && file.year ? `${getMonthName(file.month)} ${file.year}` : "Month unknown";
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <a
          href={file.webViewLink}
          target="_blank"
          rel="noreferrer"
          className="font-medium underline-offset-2 hover:underline"
        >
          {file.name}
        </a>
        <p className="text-xs text-muted-foreground">
          {monthLabel} ·{" "}
          {file.kind === "tax_invoice"
            ? "Tax invoice"
            : file.kind === "settlement"
              ? "Settlement"
              : "Unclassified"}{" "}
          · {file.folderHint}
        </p>
      </div>
      {onAttach && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={attaching}
            onClick={() => onAttach(file, "settlement")}
          >
            Use as settlement
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={attaching}
            onClick={() => onAttach(file, "tax_invoice")}
          >
            Use as tax invoice
          </Button>
        </div>
      )}
    </div>
  );
}

export function CultSettlementForm({
  month,
  year,
  settlement,
  folders,
  folderError,
  driveFiles = [],
  scanWarnings = [],
  scanSummary,
}: {
  month: number;
  year: number;
  settlement: SerializedCultSettlement | null;
  folders: Folders;
  folderError?: string | null;
  driveFiles?: CultDriveFile[];
  scanWarnings?: string[];
  scanSummary?: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const settlementInputRef = useRef<HTMLInputElement>(null);
  const taxInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(scanSummary ?? null);
  const [showDetails, setShowDetails] = useState(false);

  const monthFiles = driveFiles.filter((f) => f.month === month && f.year === year);
  const unmatched = driveFiles.filter((f) => !f.month || !f.year);

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

  function goToMonth(nextMonth: number, nextYear: number) {
    if (nextMonth === month && nextYear === year) {
      router.refresh();
      return;
    }
    router.push(`/owner/revenue?month=${nextMonth}&year=${nextYear}`);
  }

  async function scanDrive() {
    setScanning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/revenue/cult-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parsePdfs: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Drive scan failed");
        return;
      }
      const processed = (data.processed ?? []) as Array<{
        month: number;
        year: number;
        kind: string;
        fileName: string;
      }>;
      const latest = processed[processed.length - 1];
      const processedNote = latest
        ? ` Processed ${getMonthName(latest.month)} ${latest.year}.`
        : "";
      setMessage(
        `Drive scan: ${data.linked} file(s) matched to months, ${data.parsed} PDF(s) read.` +
          processedNote +
          (data.unmatched?.length ? ` ${data.unmatched.length} unmatched.` : "")
      );
      if (latest) {
        goToMonth(latest.month, latest.year);
      } else {
        router.refresh();
      }
    } catch {
      setMessage("Drive scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function uploadPdf(file: File | undefined, kind: "settlement" | "tax_invoice") {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const post = async (confirm: boolean) => {
        const body = new FormData();
        body.set("file", file);
        body.set("month", String(month));
        body.set("year", String(year));
        body.set("kind", kind);
        if (confirm) body.set("confirm", "true");
        const res = await fetch("/api/revenue/cult-invoices", { method: "POST", body });
        const data = await res.json();
        return { ok: res.ok, data };
      };

      const preview = await post(false);
      if (!preview.ok) {
        setMessage(preview.data.error ?? "Could not read PDF");
        return;
      }
      if (preview.data.needsConfirm) {
        const periodLabel = `${getMonthName(preview.data.month)} ${preview.data.year}`;
        const driveName = preview.data.canonicalName
          ? `\nDrive file: ${preview.data.canonicalName}`
          : "";
        const accepted =
          kind === "settlement"
            ? window.confirm(
                `Validated settlement PDF for ${periodLabel}:\n\n` +
                  `Partner Share: ${
                    typeof preview.data.partnerShare === "number"
                      ? formatCurrency(preview.data.partnerShare)
                      : "not found"
                  }\n` +
                  `TDS: ${
                    typeof preview.data.tds === "number" ? formatCurrency(preview.data.tds) : "—"
                  }\n` +
                  `Gross Payable: ${
                    typeof preview.data.grossPayable === "number"
                      ? formatCurrency(preview.data.grossPayable)
                      : "—"
                  }\n` +
                  driveName +
                  `\n\nSave this month and store the PDF in Drive?`
              )
            : window.confirm(
                `Tax invoice for ${periodLabel}:\n\n` +
                  `Gross Total: ${
                    typeof preview.data.taxInvoiceGrossTotal === "number"
                      ? formatCurrency(preview.data.taxInvoiceGrossTotal)
                      : "not found (will still store the PDF)"
                  }\n` +
                  driveName +
                  `\n\nSave and store this PDF in Drive?`
              );
        if (!accepted) {
          setMessage("Upload cancelled — this month was not changed");
          return;
        }
      }

      const saved = preview.data.needsConfirm ? await post(true) : preview;
      if (!saved.ok) {
        setMessage(saved.data.error ?? "Could not save PDF");
        return;
      }
      const periodNote =
        saved.data.month && saved.data.year && (saved.data.month !== month || saved.data.year !== year)
          ? ` Opened ${getMonthName(saved.data.month)} ${saved.data.year}.`
          : "";
      const nameNote = saved.data.canonicalName ? ` Stored as ${saved.data.canonicalName}.` : "";
      if (kind === "settlement") {
        const share =
          typeof saved.data.partnerShare === "number"
            ? formatCurrency(saved.data.partnerShare)
            : "not found";
        setMessage(`Saved Partner Share ${share}.${nameNote}${periodNote}` +
          (saved.data.warning ? ` ${saved.data.warning}` : ""));
      } else {
        const gross =
          typeof saved.data.taxInvoiceGrossTotal === "number"
            ? formatCurrency(saved.data.taxInvoiceGrossTotal)
            : "not read";
        setMessage(`Saved tax invoice (Gross Total ${gross}).${nameNote}${periodNote}` +
          (saved.data.warning ? ` ${saved.data.warning}` : ""));
      }
      if (saved.data.month && saved.data.year) {
        goToMonth(saved.data.month, saved.data.year);
      } else {
        router.refresh();
      }
    } catch {
      setMessage("Could not read PDF");
    } finally {
      setUploading(false);
    }
  }

  async function attach(file: CultDriveFile, kind?: CultDriveFile["kind"]) {
    setAttaching(true);
    setMessage(null);
    try {
      const res = await fetch("/api/revenue/cult-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "attach",
          fileId: file.id,
          fileName: file.name,
          webViewLink: file.webViewLink,
          mimeType: file.mimeType,
          kind: kind ?? file.kind,
          month,
          year,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Could not attach file");
        return;
      }
      setMessage(data.warning ? `Linked. ${data.warning}` : "File linked to this month");
      router.refresh();
    } catch {
      setMessage("Could not attach file");
    } finally {
      setAttaching(false);
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
              Upload a settlement (Mnt End) or tax invoice here — the app stores it in Drive with
              the month in the filename and fills that month. Or drop PDFs in the folders below and
              click Scan Drive.
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
            Folders:{" "}
            <a className="underline" href={folders.settlementUrl} target="_blank" rel="noreferrer">
              Settlement Statements
            </a>
            {" · "}
            <a className="underline" href={folders.taxInvoiceUrl} target="_blank" rel="noreferrer">
              Tax Invoices
            </a>
          </p>
        ) : folderError ? (
          <p className="text-sm text-muted-foreground">Drive folders: {folderError}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={scanDrive} disabled={scanning || uploading} className="min-h-11">
            {scanning ? "Scanning Drive…" : "Scan Drive for invoices"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={uploading || scanning}
            onClick={() => settlementInputRef.current?.click()}
          >
            {uploading ? "Reading PDF…" : "Upload settlement PDF"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={uploading || scanning}
            onClick={() => taxInputRef.current?.click()}
          >
            {uploading ? "Reading PDF…" : "Upload tax invoice"}
          </Button>
          <input
            ref={settlementInputRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            disabled={uploading || scanning}
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              e.target.value = "";
              void uploadPdf(chosen, "settlement");
            }}
          />
          <input
            ref={taxInputRef}
            type="file"
            accept="application/pdf"
            className="sr-only"
            disabled={uploading || scanning}
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              e.target.value = "";
              void uploadPdf(chosen, "tax_invoice");
            }}
          />
        </div>

        {monthFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Drive files for {getMonthName(month)} {year}
            </p>
            {monthFiles.map((file) => (
              <FileRow key={file.id} file={file} />
            ))}
          </div>
        )}

        {unmatched.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Unmatched Drive files — attach to this month</p>
            {unmatched.map((file) => (
              <FileRow key={file.id} file={file} onAttach={attach} attaching={attaching} />
            ))}
          </div>
        )}

        {driveFiles.length === 0 && !folderError && (
          <p className="text-sm text-muted-foreground">
            No invoice PDFs found yet. Upload both types here, or add them in Drive and click Scan
            Drive. Share the gym Drive folder with the Google service account if files do not appear.
          </p>
        )}

        {scanWarnings.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {scanWarnings.slice(0, 8).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id="partnerShare"
              name="partnerShare"
              label="Partner Share (canonical)"
              defaultValue={settlement?.partnerShare}
              hint="Filled from settlement PDF when text can be read"
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
              <Field id="tds" name="tds" label="TDS withheld" defaultValue={settlement?.tds} hint="Not added to Cult income" />
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
          {message && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{message}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
