import { prisma } from "@/lib/prisma";
import { formatDateDMY } from "@/lib/import/parse-csv-dates";
import { decimalToNumber } from "@/lib/utils";
import { writeSheetTab } from "@/lib/google/sheets-write";
import {
  TRAINER_SHEET_TABS,
  SHEET_HEADERS,
} from "@/lib/sheet-config";
import type { PaymentMode } from "@prisma/client";

function formatFeePaidOn(paymentDate: Date, collectedAt: Date | null): string {
  const paid = collectedAt ?? paymentDate;
  const paidStr = formatDateDMY(paid);
  const startStr = formatDateDMY(paymentDate);
  if (paidStr === startStr) return "yes";
  return `yes ${paidStr}`;
}

function formatPaymentModeText(
  mode: PaymentMode | null | undefined,
  notes: string | null | undefined
): string {
  if (notes?.trim()) return notes.trim();
  if (!mode) return "";
  const labels: Record<PaymentMode, string> = {
    CASH: "Cash",
    UPI: "UPI",
    CARD: "Card",
    BANK_TRANSFER: "Bank Transfer",
    OTHER: "Other",
  };
  return labels[mode];
}

export type ExportRow = {
  customer: string;
  startDate: Date;
  endDate: Date;
  feePaidOn: string;
  amount: number;
  months: number;
  paymentMode: string;
  phone: string;
  notes: string;
};

export async function fetchTrainerExportRows(
  gymId: string,
  trainerName: string
): Promise<ExportRow[]> {
  const trainer = await prisma.employee.findFirst({
    where: {
      gymId,
      employeeType: "TRAINER",
      user: { name: { equals: trainerName, mode: "insensitive" } },
    },
  });
  if (!trainer) return [];

  const subscriptions = await prisma.pTSubscription.findMany({
    where: { client: { trainerId: trainer.id } },
    include: {
      client: true,
      payments: { orderBy: { installmentIndex: "asc" }, take: 1 },
    },
    orderBy: [{ startDate: "asc" }, { client: { name: "asc" } }],
  });

  return subscriptions.map((sub) => {
    const firstPayment = sub.payments[0];
    return {
      customer: sub.client.name,
      startDate: sub.startDate,
      endDate: sub.endDate,
      feePaidOn: formatFeePaidOn(
        sub.paymentDate,
        firstPayment?.collectedAt ?? firstPayment?.paidAt ?? null
      ),
      amount: decimalToNumber(sub.amount),
      months: sub.monthsCount ?? 1,
      paymentMode: formatPaymentModeText(
        firstPayment?.paymentMode,
        firstPayment?.notes ?? sub.notes
      ),
      phone: sub.client.phone ?? "",
      notes: sub.notes && sub.notes !== firstPayment?.notes ? sub.notes : "",
    };
  });
}

function buildTabRows(trainerName: string, dataRows: ExportRow[]): string[][] {
  const header = [
    `Ojas PT Tracker | Trainer: ${trainerName} | Master copy — source of truth | Dates: DD/MM/YYYY`,
  ];
  const rows: string[][] = [header, [...SHEET_HEADERS]];

  for (const row of dataRows) {
    rows.push([
      row.customer,
      formatDateDMY(row.startDate),
      formatDateDMY(row.endDate),
      row.feePaidOn,
      String(row.amount),
      String(row.months),
      row.paymentMode,
      row.phone,
      row.notes,
    ]);
  }

  return rows;
}

export async function exportGymToGoogleSheet(gymId: string) {
  const results: Array<{
    tabName: string;
    rowCount: number;
  }> = [];

  for (const tabName of TRAINER_SHEET_TABS) {
    const dataRows = await fetchTrainerExportRows(gymId, tabName);
    const sheetRows = buildTabRows(tabName, dataRows);
    await writeSheetTab(tabName, sheetRows);
    results.push({ tabName, rowCount: dataRows.length });
  }

  return results;
}
