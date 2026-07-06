"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { getMonthName } from "@/lib/permissions";
import { readApiError } from "@/lib/fetch-api";
import type { SplitRuleDTO } from "@/lib/services/trainer-split-rules";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

type RuleFormState = {
  startMonth: number;
  startYear: number;
  endMonth: string;
  endYear: string;
  mode: "FLAT" | "TARGET_BASED";
  flatPercent: string;
  monthlyTarget: string;
  splitBelowTarget: string;
  splitAboveTarget: string;
  notes: string;
};

function emptyForm(): RuleFormState {
  const now = new Date();
  return {
    startMonth: now.getMonth() + 1,
    startYear: now.getFullYear(),
    endMonth: "",
    endYear: "",
    mode: "TARGET_BASED",
    flatPercent: "45",
    monthlyTarget: "60000",
    splitBelowTarget: "45",
    splitAboveTarget: "50",
    notes: "",
  };
}

function ruleToForm(rule: SplitRuleDTO): RuleFormState {
  return {
    startMonth: rule.startMonth,
    startYear: rule.startYear,
    endMonth: rule.endMonth != null ? String(rule.endMonth) : "",
    endYear: rule.endYear != null ? String(rule.endYear) : "",
    mode: rule.mode,
    flatPercent: rule.flatPercent != null ? String(rule.flatPercent) : "",
    monthlyTarget: rule.monthlyTarget != null ? String(rule.monthlyTarget) : "",
    splitBelowTarget: rule.splitBelowTarget != null ? String(rule.splitBelowTarget) : "",
    splitAboveTarget: rule.splitAboveTarget != null ? String(rule.splitAboveTarget) : "",
    notes: rule.notes ?? "",
  };
}

function formatPeriod(
  month: number,
  year: number,
  endMonth: number | null,
  endYear: number | null
) {
  const from = `${getMonthName(month)} ${year}`;
  if (endMonth == null || endYear == null) return from;
  const to = `${getMonthName(endMonth)} ${endYear}`;
  return from === to ? from : `${from} – ${to}`;
}

function isPastMonth(month: number, year: number): boolean {
  const now = new Date();
  const current = now.getFullYear() * 12 + (now.getMonth() + 1);
  return year * 12 + month < current;
}

export function TrainerSplitRulesPanel({
  employeeId,
  trainerName,
}: {
  employeeId: string;
  trainerName: string;
}) {
  const router = useRouter();
  const [rules, setRules] = useState<SplitRuleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleFormState>(emptyForm);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trainers/${employeeId}/split-rules`);
      if (!res.ok) {
        setError(await readApiError(res, "Failed to load rules"));
        return;
      }
      const data = await res.json();
      setRules(data.rules ?? []);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
    setError("");
  }

  function openEdit(rule: SplitRuleDTO) {
    setEditingId(rule.id);
    setForm(ruleToForm(rule));
    setShowForm(true);
    setError("");
  }

  function buildPayload() {
    return {
      startMonth: form.startMonth,
      startYear: form.startYear,
      endMonth: form.endMonth ? Number(form.endMonth) : null,
      endYear: form.endYear ? Number(form.endYear) : null,
      mode: form.mode,
      flatPercent: form.mode === "FLAT" ? Number(form.flatPercent) : null,
      monthlyTarget: form.mode === "TARGET_BASED" ? Number(form.monthlyTarget) : null,
      splitBelowTarget: form.mode === "TARGET_BASED" ? Number(form.splitBelowTarget) : null,
      splitAboveTarget: form.mode === "TARGET_BASED" ? Number(form.splitAboveTarget) : null,
      notes: form.notes || null,
      recalculate: true,
    };
  }

  async function saveRule() {
    const payload = buildPayload();
    const affectsPast =
      isPastMonth(payload.startMonth, payload.startYear) ||
      (payload.endMonth != null &&
        payload.endYear != null &&
        isPastMonth(payload.endMonth, payload.endYear));

    if (affectsPast) {
      const from = `${getMonthName(payload.startMonth)} ${payload.startYear}`;
      const to =
        payload.endMonth && payload.endYear
          ? `${getMonthName(payload.endMonth)} ${payload.endYear}`
          : "current month";
      if (
        !window.confirm(
          `This will recalculate PT shares for ${trainerName} from ${from} through ${to}. Continue?`
        )
      ) {
        return;
      }
    }

    setSaving(true);
    setError("");
    setMessage("");

    const url = editingId
      ? `/api/trainers/${employeeId}/split-rules/${editingId}`
      : `/api/trainers/${employeeId}/split-rules`;
    const method = editingId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!res.ok) {
      setError(await readApiError(res, "Save failed"));
      return;
    }

    const data = await res.json();
    setMessage(
      `Rule saved. Recalculated ${data.monthsRecalculated ?? 0} month(s).`
    );
    setShowForm(false);
    setEditingId(null);
    await loadRules();
    router.refresh();
  }

  async function deleteRule(rule: SplitRuleDTO) {
    const period = formatPeriod(
      rule.startMonth,
      rule.startYear,
      rule.endMonth,
      rule.endYear
    );
    if (
      !window.confirm(`Delete split rule for ${period}? This will recalculate affected months.`)
    ) {
      return;
    }

    setSaving(true);
    setError("");
    const res = await fetch(
      `/api/trainers/${employeeId}/split-rules/${rule.id}?recalculate=true`,
      { method: "DELETE" }
    );
    setSaving(false);
    if (!res.ok) {
      setError(await readApiError(res, "Delete failed"));
      return;
    }
    const data = await res.json();
    setMessage(`Rule deleted. Recalculated ${data.monthsRecalculated ?? 0} month(s).`);
    await loadRules();
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-3 rounded-md border border-dashed bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">PT Split Rules — {trainerName}</p>
          <p className="text-xs text-muted-foreground">
            Set flat or target-based % by time period. Past and future months supported.
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={openAdd} disabled={saving}>
          Add Rule
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading rules…</p>
      ) : rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No split rules yet. Add a period (e.g. Jan 2026 flat 45%, Feb 2026+ target 45/50%).
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-2 font-medium">From</th>
                <th className="py-2 pr-2 font-medium">To</th>
                <th className="py-2 pr-2 font-medium">Mode</th>
                <th className="py-2 pr-2 font-medium text-right">Target</th>
                <th className="py-2 pr-2 font-medium text-right">Below</th>
                <th className="py-2 pr-2 font-medium text-right">Above / Flat</th>
                <th className="py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b last:border-0">
                  <td className="py-2 pr-2">
                    {getMonthName(rule.startMonth)} {rule.startYear}
                  </td>
                  <td className="py-2 pr-2">
                    {rule.endMonth && rule.endYear ? (
                      `${getMonthName(rule.endMonth)} ${rule.endYear}`
                    ) : (
                      <Badge variant="secondary">Ongoing</Badge>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {rule.mode === "FLAT" ? "Flat" : "Target"}
                  </td>
                  <td className="py-2 pr-2 text-right">
                    {rule.monthlyTarget != null ? formatCurrency(rule.monthlyTarget) : "—"}
                  </td>
                  <td className="py-2 pr-2 text-right">
                    {rule.splitBelowTarget != null ? `${rule.splitBelowTarget}%` : "—"}
                  </td>
                  <td className="py-2 pr-2 text-right">
                    {rule.mode === "FLAT"
                      ? `${rule.flatPercent}%`
                      : `${rule.splitAboveTarget}%`}
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(rule)}
                        disabled={saving}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteRule(rule)}
                        disabled={saving}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="space-y-3 rounded-md border bg-background p-4">
          <p className="text-sm font-medium">{editingId ? "Edit Rule" : "Add Rule"}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label>From month</Label>
              <select
                className="flex h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={form.startMonth}
                onChange={(e) => setForm({ ...form, startMonth: Number(e.target.value) })}
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {getMonthName(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>From year</Label>
              <Input
                type="number"
                min={2020}
                value={form.startYear}
                onChange={(e) => setForm({ ...form, startYear: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label>To month (optional)</Label>
              <select
                className="flex h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={form.endMonth}
                onChange={(e) => setForm({ ...form, endMonth: e.target.value })}
              >
                <option value="">Ongoing</option>
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {getMonthName(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>To year</Label>
              <Input
                type="number"
                min={2020}
                placeholder="Ongoing"
                value={form.endYear}
                onChange={(e) => setForm({ ...form, endYear: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Mode</Label>
            <select
              className="flex h-9 w-full max-w-xs rounded-md border bg-background px-2 text-sm"
              value={form.mode}
              onChange={(e) =>
                setForm({ ...form, mode: e.target.value as "FLAT" | "TARGET_BASED" })
              }
            >
              <option value="FLAT">Flat % (fixed rate)</option>
              <option value="TARGET_BASED">Target-based (below / above)</option>
            </select>
          </div>

          {form.mode === "FLAT" ? (
            <div className="space-y-1 max-w-xs">
              <Label>Split %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.flatPercent}
                onChange={(e) => setForm({ ...form, flatPercent: e.target.value })}
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Monthly target (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.monthlyTarget}
                  onChange={(e) => setForm({ ...form, monthlyTarget: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Below target %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.splitBelowTarget}
                  onChange={(e) => setForm({ ...form, splitBelowTarget: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Target met %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.splitAboveTarget}
                  onChange={(e) => setForm({ ...form, splitAboveTarget: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Jan promo rate"
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={saveRule} disabled={saving}>
              {saving ? "Saving…" : "Save & Apply to Affected Months"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-emerald-600">{message}</p>}
    </div>
  );
}
