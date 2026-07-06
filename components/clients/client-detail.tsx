import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency, decimalToNumber, PAYMENT_MODE_LABELS } from "@/lib/utils";
import type { SessionUser } from "@/lib/permissions";
import { canViewClient } from "@/lib/permissions";
import { notFound } from "next/navigation";
import {
  AddSubscriptionForm,
  AddSessionForm,
  ProgressForms,
  PhotoUploadForm,
} from "@/components/forms/client-forms";
import { ClientDetailHeader } from "@/components/clients/client-detail-header";
import { ProgressChart } from "@/components/charts/progress-chart";
import { groupMeasurementsByType } from "@/lib/services/client-progress";

export async function ClientDetailView({
  clientId,
  user,
  backHref,
}: {
  clientId: string;
  user: SessionUser;
  backHref: string;
}) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, gymId: user.gymId },
    include: {
      trainer: { include: { user: true } },
      subscriptions: { orderBy: { endDate: "desc" }, include: { payments: true } },
      sessions: { orderBy: { scheduledAt: "desc" }, take: 15 },
      goals: { orderBy: { createdAt: "desc" } },
      measurements: { orderBy: { recordedAt: "asc" } },
      notes: { orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }] },
      dietPrograms: { orderBy: { createdAt: "desc" } },
      progressPhotos: { orderBy: { takenAt: "desc" } },
    },
  });

  if (!client || !canViewClient(user.role, client.trainerId, user.employeeId)) {
    notFound();
  }

  const grouped = groupMeasurementsByType(client.measurements);
  const weightGoal = client.goals.find((g) => g.goalType === "WEIGHT_LOSS");
  const canEdit = user.role === "OWNER" || user.role === "TRAINER";
  const canDelete = canEdit;

  return (
    <div className="space-y-6">
      <ClientDetailHeader
        name={client.name}
        phone={client.phone}
        trainerName={client.trainer.user.name}
        status={client.status}
        clientId={client.id}
        backHref={backHref}
        canDelete={canDelete}
      />

      {client.notes.filter((n) => n.isPinned).length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-900">Important Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {client.notes
              .filter((n) => n.isPinned)
              .map((note) => (
                <p key={note.id} className="text-sm text-amber-900">
                  {note.content}
                </p>
              ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Subscriptions & Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {client.subscriptions.map((sub) => (
              <div key={sub.id} className="rounded-lg border p-3 text-sm space-y-2">
                <p className="font-medium">{formatCurrency(decimalToNumber(sub.amount))}</p>
                <p className="text-muted-foreground">
                  {formatDate(sub.startDate)} → {formatDate(sub.endDate)}
                  {sub.monthsCount ? ` · ${sub.monthsCount} month(s)` : ""}
                </p>
                {sub.sessionsTotal && (
                  <p className="text-muted-foreground">
                    Sessions: {sub.sessionsUsed}/{sub.sessionsTotal}
                  </p>
                )}
                <Badge variant={sub.status === "EXPIRING" ? "warning" : "secondary"}>
                  {sub.status}
                </Badge>
                {sub.payments.map((payment) => (
                  <div key={payment.id} className="mt-2 rounded border bg-muted/30 p-2">
                    <p className="font-medium">
                      {formatCurrency(decimalToNumber(payment.amount))}
                      {payment.installmentIndex != null && sub.monthsCount
                        ? ` · Month ${payment.installmentIndex + 1} of ${sub.monthsCount}`
                        : ""}
                    </p>
                    <p className="text-muted-foreground">
                      Service month: {formatDate(payment.paidAt)}
                      {payment.payableAt
                        ? ` · Trainer payable: ${formatDate(payment.payableAt)}`
                        : ""}
                    </p>
                    <p className="text-muted-foreground">
                      Trainer {formatCurrency(decimalToNumber(payment.trainerShareAmount))}
                      {payment.splitPercentUsed
                        ? ` (${decimalToNumber(payment.splitPercentUsed)}%)`
                        : ""}
                      {" · "}
                      Owner {formatCurrency(decimalToNumber(payment.ownerShareAmount))}
                    </p>
                    {payment.paymentMode && (
                      <p className="text-muted-foreground">
                        {PAYMENT_MODE_LABELS[payment.paymentMode] ?? payment.paymentMode}
                      </p>
                    )}
                    {payment.proofUrl && (
                      <a
                        href={payment.proofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={payment.proofUrl}
                          alt="Payment proof"
                          className="max-h-32 rounded border object-contain"
                        />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {client.sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions logged.</p>
            ) : (
              client.sessions.map((s) => (
                <div key={s.id} className="flex justify-between rounded border p-2 text-sm">
                  <span>{formatDate(s.scheduledAt)}</span>
                  <Badge variant={s.status === "COMPLETED" ? "success" : "secondary"}>{s.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {canEdit && (
        <>
          <AddSubscriptionForm clientId={client.id} />
          <AddSessionForm clientId={client.id} />
          <ProgressForms clientId={client.id} />
          <PhotoUploadForm clientId={client.id} />
        </>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <ProgressChart
          data={grouped.WEIGHT ?? []}
          title="Weight Progress"
          targetValue={weightGoal?.targetValue ? decimalToNumber(weightGoal.targetValue) : undefined}
          unit="kg"
        />
        <ProgressChart
          data={grouped.BODY_FAT ?? []}
          title="Body Fat %"
          unit="%"
        />
      </div>

      {client.goals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Goals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {client.goals.map((g) => (
              <div key={g.id} className="rounded border p-3 text-sm">
                <p className="font-medium">{g.title}</p>
                <p className="text-muted-foreground">
                  {g.currentValue?.toString() ?? "—"} → {g.targetValue?.toString() ?? "—"} {g.unit}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {client.progressPhotos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progress Photos</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {client.progressPhotos.map((photo) => (
              <div key={photo.id} className="overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.imageUrl} alt={photo.caption ?? "Progress"} className="aspect-square object-cover" />
                <p className="p-2 text-xs text-muted-foreground">{formatDate(photo.takenAt)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
