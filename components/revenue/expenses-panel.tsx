"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, PAYMENT_MODE_LABELS } from "@/lib/utils";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/revenue-constants";
import type { SerializedExpense } from "@/lib/services/expenses";
import {
  canMutateExpenseKind,
  categoriesForKind,
  defaultCategoryForKind,
  defaultKindForRole,
  EXPENSE_KIND_LABELS,
} from "@/lib/services/expense-kinds";
import type { ExpenseCategory, ExpenseKind, PaymentMode, UserRole } from "@prisma/client";

const PAYMENT_MODES: PaymentMode[] = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"];

const OWNER_KINDS: ExpenseKind[] = ["OWNER_BILL", "SUPERVISOR_ADVANCE"];

function emptyForm(role: UserRole) {
  const kind = defaultKindForRole(role);
  return {
    date: new Date().toISOString().slice(0, 10),
    kind,
    category: defaultCategoryForKind(kind) as ExpenseCategory,
    description: "",
    amount: "",
    paymentMode: "" as "" | PaymentMode,
    paidBy: "",
    notes: "",
  };
}

export function ExpensesPanel({
  expenses,
  monthLabel,
  sheetUrl,
  supervisorSheetUrl,
  sheetError,
  role,
}: {
  expenses: SerializedExpense[];
  monthLabel: string;
  sheetUrl?: string | null;
  supervisorSheetUrl?: string | null;
  sheetError?: string | null;
  role: UserRole;
}) {
  const router = useRouter();
  const [form, setForm] = useState(() => emptyForm(role));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const total = useMemo(
    () => expenses.reduce((sum, row) => sum + row.amount, 0),
    [expenses]
  );
  const categoryOptions = categoriesForKind(form.kind);
  const isOwner = role === "OWNER";

  function applyKind(kind: ExpenseKind) {
    setForm((f) => ({
      ...f,
      kind,
      category: categoriesForKind(kind).includes(f.category)
        ? f.category
        : defaultCategoryForKind(kind),
      description:
        kind === "SUPERVISOR_ADVANCE" && (!f.description || f.description === "Cash given to supervisor")
          ? "Cash given to supervisor"
          : kind !== "SUPERVISOR_ADVANCE" && f.description === "Cash given to supervisor"
            ? ""
            : f.description,
      paidBy: kind === "SUPERVISOR_ADVANCE" && !f.paidBy ? "Owner" : f.paidBy,
    }));
  }

  function startEdit(row: SerializedExpense) {
    setEditingId(row.id);
    setForm({
      date: row.date,
      kind: row.kind,
      category: row.category,
      description: row.description,
      amount: String(row.amount),
      paymentMode: row.paymentMode ?? "",
      paidBy: row.paidBy ?? "",
      notes: row.notes ?? "",
    });
    setMessage(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm(role));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const payload = {
      date: form.date,
      kind: form.kind,
      category: form.category,
      description: form.description,
      amount: Number(form.amount),
      paymentMode: form.paymentMode || undefined,
      paidBy: form.paidBy || undefined,
      notes: form.notes || undefined,
    };
    try {
      const res = await fetch(editingId ? `/api/expenses/${editingId}` : "/api/expenses", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Save failed");
        return;
      }
      setMessage(
        data.sheetError
          ? `Saved in app. Sheet update failed: ${data.sheetError}`
          : editingId
            ? "Expense updated"
            : form.kind === "SUPERVISOR_ADVANCE"
              ? "Cash given to supervisor"
              : "Expense added"
      );
      resetForm();
      router.refresh();
    } catch {
      setMessage("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this expense? This cannot be undone.")) return;
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Delete failed");
      return;
    }
    setMessage(
      data.sheetError
        ? `Deleted in app. Remove the row from the sheet if it is still there: ${data.sheetError}`
        : "Expense deleted"
    );
    if (editingId === id) resetForm();
    router.refresh();
  }

  async function syncSheet() {
    if (!confirm("Pull expenses from the Google Sheet and merge into the app?")) return;
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/expenses/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Sync failed");
        return;
      }
      const extra = data.errors?.length ? ` Errors: ${data.errors.slice(0, 4).join("; ")}` : "";
      const sheetNote = data.sheetError ? ` ${data.sheetError}` : "";
      setMessage(
        `Sheet sync ${data.status}: ${data.created} created, ${data.updated} updated.${extra}${sheetNote}`
      );
      router.refresh();
    } catch {
      setMessage("Sheet sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const title = isOwner ? "Gym expenses" : "Supervisor spends";
  const description = isOwner
    ? `${monthLabel} · ${formatCurrency(total)} in this list. Gym bills and cash given to the supervisor count in Revenue. Supervisor spends are tracked only.`
    : `${monthLabel} · ${formatCurrency(total)} in this list. Record what you spent from cash the owner gave you. That cash is already in Revenue.`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>
              {description}{" "}
              {isOwner ? (
                <>
                  Sheet tabs: Expenses
                  {sheetUrl ? (
                    <>
                      {" · "}
                      <a className="underline" href={sheetUrl} target="_blank" rel="noreferrer">
                        Open Expenses
                      </a>
                    </>
                  ) : null}
                  {" · "}Supervisor spends
                  {supervisorSheetUrl ? (
                    <>
                      {" · "}
                      <a className="underline" href={supervisorSheetUrl} target="_blank" rel="noreferrer">
                        Open Supervisor spends
                      </a>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  Sheet tab: Supervisor spends
                  {supervisorSheetUrl ? (
                    <>
                      {" · "}
                      <a className="underline" href={supervisorSheetUrl} target="_blank" rel="noreferrer">
                        Open Supervisor spends sheet
                      </a>
                    </>
                  ) : sheetUrl ? (
                    <>
                      {" · "}
                      <a className="underline" href={sheetUrl} target="_blank" rel="noreferrer">
                        Open sheet
                      </a>
                    </>
                  ) : null}
                </>
              )}
              {sheetError ? ` · Sheet: ${sheetError}` : null}
            </CardDescription>
          </div>
          {isOwner ? (
            <Button variant="outline" onClick={syncSheet} disabled={syncing} className="min-h-11">
              {syncing ? "Syncing…" : "Sync from expense sheet"}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {isOwner ? (
              <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="expense-kind">Type</Label>
                <select
                  id="expense-kind"
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.kind}
                  onChange={(e) => applyKind(e.target.value as ExpenseKind)}
                >
                  {OWNER_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind === "OWNER_BILL"
                        ? "Gym bill (counts in Revenue)"
                        : "Cash given to supervisor (counts in Revenue)"}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="expense-date">Date</Label>
              <Input
                id="expense-date"
                type="date"
                required
                className="min-h-11"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expense-category">Category</Label>
              <select
                id="expense-category"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))
                }
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {EXPENSE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="expense-amount">Amount (₹)</Label>
              <Input
                id="expense-amount"
                type="number"
                inputMode="decimal"
                min={0.01}
                step="0.01"
                required
                className="min-h-11"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="expense-description">Description</Label>
              <Input
                id="expense-description"
                required
                className="min-h-11"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expense-mode">Payment mode</Label>
              <select
                id="expense-mode"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.paymentMode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, paymentMode: e.target.value as "" | PaymentMode }))
                }
              >
                <option value="">—</option>
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="expense-paid-by">Paid by</Label>
              <Input
                id="expense-paid-by"
                className="min-h-11"
                value={form.paidBy}
                onChange={(e) => setForm((f) => ({ ...f, paidBy: e.target.value }))}
              />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="expense-notes">Notes</Label>
              <Textarea
                id="expense-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={saving} className="min-h-11 w-full sm:w-auto">
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Update expense"
                    : form.kind === "SUPERVISOR_ADVANCE"
                      ? "Give cash"
                      : isOwner
                        ? "Add gym bill"
                        : "Add spend"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm} className="min-h-11">
                  Cancel edit
                </Button>
              )}
            </div>
          </form>
          {message && <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{message}</p>}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isOwner ? "No expenses in this view yet." : "No spends in this view yet. Log one above."}
          </p>
        ) : (
          expenses.map((row) => {
            const canEdit = canMutateExpenseKind(role, row.kind);
            return (
              <Card key={row.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{row.description}</p>
                      <Badge variant="secondary">{EXPENSE_CATEGORY_LABELS[row.category]}</Badge>
                      <Badge variant={row.kind === "SUPERVISOR_SPEND" ? "outline" : "default"}>
                        {EXPENSE_KIND_LABELS[row.kind]}
                      </Badge>
                      {row.source === "IMPORT" && <Badge variant="outline">Sheet</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {row.date.split("-").reverse().join("/")}
                      {row.paidBy ? ` · ${row.paidBy}` : ""}
                      {row.paymentMode ? ` · ${PAYMENT_MODE_LABELS[row.paymentMode]}` : ""}
                      {row.createdByName ? ` · ${row.createdByName}` : ""}
                      {row.kind === "SUPERVISOR_SPEND" ? " · not in Revenue" : " · in Revenue"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{formatCurrency(row.amount)}</p>
                    {canEdit ? (
                      <>
                        <Button size="sm" variant="outline" className="min-h-11" onClick={() => startEdit(row)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="destructive" className="min-h-11" onClick={() => remove(row.id)}>
                          Delete
                        </Button>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Owner entry</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
