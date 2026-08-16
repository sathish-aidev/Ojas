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
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/revenue-constants";
import type { SerializedExpense } from "@/lib/services/expenses";
import type { ExpenseCategory, PaymentMode } from "@prisma/client";

const PAYMENT_MODES: PaymentMode[] = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"];

function emptyForm() {
  return {
    date: new Date().toISOString().slice(0, 10),
    category: "RENT" as ExpenseCategory,
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
  sheetError,
}: {
  expenses: SerializedExpense[];
  monthLabel: string;
  sheetUrl?: string | null;
  sheetError?: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const total = useMemo(
    () => expenses.reduce((sum, row) => sum + row.amount, 0),
    [expenses]
  );

  function startEdit(row: SerializedExpense) {
    setEditingId(row.id);
    setForm({
      date: row.date,
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
    setForm(emptyForm());
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const payload = {
      date: form.date,
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
      setMessage(
        `Sheet sync ${data.status}: ${data.created} created, ${data.updated} updated.${extra}`
      );
      router.refresh();
    } catch {
      setMessage("Sheet sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg">Gym expenses</CardTitle>
            <CardDescription>
              {monthLabel} · {formatCurrency(total)} entered here. Paid payroll is added
              separately on the Revenue dashboard — do not re-enter trainer salaries already
              marked Paid. Sheet tab: Expenses
              {sheetUrl ? (
                <>
                  {" · "}
                  <a className="underline" href={sheetUrl} target="_blank" rel="noreferrer">
                    Open Expenses sheet
                  </a>
                </>
              ) : null}
              {sheetError ? ` · Sheet: ${sheetError}` : null}
            </CardDescription>
          </div>
          <Button variant="outline" onClick={syncSheet} disabled={syncing} className="min-h-11">
            {syncing ? "Syncing…" : "Sync from expense sheet"}
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="expense-date">Date</Label>
              <Input
                id="expense-date"
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expense-category">Category</Label>
              <select
                id="expense-category"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))
                }
              >
                {EXPENSE_CATEGORIES.map((c) => (
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
                min={0.01}
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="expense-description">Description</Label>
              <Input
                id="expense-description"
                required
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expense-mode">Payment mode</Label>
              <select
                id="expense-mode"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
              <Button type="submit" disabled={saving} className="min-h-11">
                {saving ? "Saving…" : editingId ? "Update expense" : "Add expense"}
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
          <p className="text-sm text-muted-foreground">No expenses for this month yet.</p>
        ) : (
          expenses.map((row) => (
            <Card key={row.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.description}</p>
                    <Badge variant="secondary">{EXPENSE_CATEGORY_LABELS[row.category]}</Badge>
                    {row.source === "IMPORT" && <Badge variant="outline">Sheet</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {row.date.split("-").reverse().join("/")}
                    {row.paidBy ? ` · ${row.paidBy}` : ""}
                    {row.paymentMode ? ` · ${PAYMENT_MODE_LABELS[row.paymentMode]}` : ""}
                    {row.createdByName ? ` · ${row.createdByName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{formatCurrency(row.amount)}</p>
                  <Button size="sm" variant="outline" onClick={() => startEdit(row)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(row.id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
