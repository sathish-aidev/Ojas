import type { CultSettlement, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/utils";
import { parseOptionalDate, toYmd } from "@/lib/date-ymd";
import { resolveCultIncome } from "@/lib/revenue-constants";

export type CultSettlementInput = {
  month: number;
  year: number;
  periodStart?: string;
  periodEnd?: string;
  partnerShare?: number;
  taxInvoiceGrossTotal?: number;
  saleOfNewPacks?: number;
  walkInsOuts?: number;
  otherAdjustments?: number;
  platformFees?: number;
  totalRevenue?: number;
  cmCharges?: number;
  maintInfraCharges?: number;
  centerCollections?: number;
  midMonthPayment?: number;
  tds?: number;
  grossPayable?: number;
  notes?: string;
  settlementDriveUrl?: string;
  taxInvoiceDriveUrl?: string;
};

export type SerializedCultSettlement = {
  id: string;
  month: number;
  year: number;
  periodStart: string | null;
  periodEnd: string | null;
  partnerShare: number | null;
  taxInvoiceGrossTotal: number | null;
  saleOfNewPacks: number | null;
  walkInsOuts: number | null;
  otherAdjustments: number | null;
  platformFees: number | null;
  totalRevenue: number | null;
  cmCharges: number | null;
  maintInfraCharges: number | null;
  centerCollections: number | null;
  midMonthPayment: number | null;
  tds: number | null;
  grossPayable: number | null;
  notes: string | null;
  settlementDriveUrl: string | null;
  taxInvoiceDriveUrl: string | null;
  enteredByUserId: string | null;
  cultIncome: ReturnType<typeof resolveCultIncome>;
  createdAt: string;
  updatedAt: string;
};

function num(value: { toString(): string } | null): number | null {
  if (value == null) return null;
  return decimalToNumber(value);
}

export function serializeCultSettlement(row: CultSettlement): SerializedCultSettlement {
  const partnerShare = num(row.partnerShare);
  const taxInvoiceGrossTotal = num(row.taxInvoiceGrossTotal);
  return {
    id: row.id,
    month: row.month,
    year: row.year,
    periodStart: row.periodStart ? toYmd(row.periodStart) : null,
    periodEnd: row.periodEnd ? toYmd(row.periodEnd) : null,
    partnerShare,
    taxInvoiceGrossTotal,
    saleOfNewPacks: num(row.saleOfNewPacks),
    walkInsOuts: num(row.walkInsOuts),
    otherAdjustments: num(row.otherAdjustments),
    platformFees: num(row.platformFees),
    totalRevenue: num(row.totalRevenue),
    cmCharges: num(row.cmCharges),
    maintInfraCharges: num(row.maintInfraCharges),
    centerCollections: num(row.centerCollections),
    midMonthPayment: num(row.midMonthPayment),
    tds: num(row.tds),
    grossPayable: num(row.grossPayable),
    notes: row.notes,
    settlementDriveUrl: row.settlementDriveUrl,
    taxInvoiceDriveUrl: row.taxInvoiceDriveUrl,
    enteredByUserId: row.enteredByUserId,
    cultIncome: resolveCultIncome({ partnerShare, taxInvoiceGrossTotal }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPartialUpdate(input: Partial<CultSettlementInput>): Prisma.CultSettlementUpdateInput {
  const data: Prisma.CultSettlementUpdateInput = {};
  if (input.periodStart !== undefined) data.periodStart = parseOptionalDate(input.periodStart);
  if (input.periodEnd !== undefined) data.periodEnd = parseOptionalDate(input.periodEnd);
  if (input.partnerShare !== undefined) data.partnerShare = input.partnerShare;
  if (input.taxInvoiceGrossTotal !== undefined) data.taxInvoiceGrossTotal = input.taxInvoiceGrossTotal;
  if (input.saleOfNewPacks !== undefined) data.saleOfNewPacks = input.saleOfNewPacks;
  if (input.walkInsOuts !== undefined) data.walkInsOuts = input.walkInsOuts;
  if (input.otherAdjustments !== undefined) data.otherAdjustments = input.otherAdjustments;
  if (input.platformFees !== undefined) data.platformFees = input.platformFees;
  if (input.totalRevenue !== undefined) data.totalRevenue = input.totalRevenue;
  if (input.cmCharges !== undefined) data.cmCharges = input.cmCharges;
  if (input.maintInfraCharges !== undefined) data.maintInfraCharges = input.maintInfraCharges;
  if (input.centerCollections !== undefined) data.centerCollections = input.centerCollections;
  if (input.midMonthPayment !== undefined) data.midMonthPayment = input.midMonthPayment;
  if (input.tds !== undefined) data.tds = input.tds;
  if (input.grossPayable !== undefined) data.grossPayable = input.grossPayable;
  if (input.notes !== undefined) data.notes = input.notes.trim() || null;
  if (input.settlementDriveUrl !== undefined) {
    data.settlementDriveUrl = input.settlementDriveUrl.trim() || null;
  }
  if (input.taxInvoiceDriveUrl !== undefined) {
    data.taxInvoiceDriveUrl = input.taxInvoiceDriveUrl.trim() || null;
  }
  return data;
}

function toUpdateData(input: CultSettlementInput): Prisma.CultSettlementUpdateInput {
  const data: Prisma.CultSettlementUpdateInput = {
    periodStart: parseOptionalDate(input.periodStart),
    periodEnd: parseOptionalDate(input.periodEnd),
    partnerShare: input.partnerShare ?? null,
    taxInvoiceGrossTotal: input.taxInvoiceGrossTotal ?? null,
    notes: input.notes?.trim() || null,
    settlementDriveUrl: input.settlementDriveUrl?.trim() || null,
    taxInvoiceDriveUrl: input.taxInvoiceDriveUrl?.trim() || null,
  };

  const details: Array<keyof CultSettlementInput> = [
    "saleOfNewPacks",
    "walkInsOuts",
    "otherAdjustments",
    "platformFees",
    "totalRevenue",
    "cmCharges",
    "maintInfraCharges",
    "centerCollections",
    "midMonthPayment",
    "tds",
    "grossPayable",
  ];
  for (const key of details) {
    if (input[key] !== undefined) {
      (data as Record<string, unknown>)[key] = input[key];
    }
  }
  return data;
}

function toCreateData(
  gymId: string,
  userId: string,
  input: CultSettlementInput
): Prisma.CultSettlementCreateInput {
  return {
    gym: { connect: { id: gymId } },
    month: input.month,
    year: input.year,
    periodStart: parseOptionalDate(input.periodStart),
    periodEnd: parseOptionalDate(input.periodEnd),
    partnerShare: input.partnerShare ?? null,
    taxInvoiceGrossTotal: input.taxInvoiceGrossTotal ?? null,
    saleOfNewPacks: input.saleOfNewPacks ?? null,
    walkInsOuts: input.walkInsOuts ?? null,
    otherAdjustments: input.otherAdjustments ?? null,
    platformFees: input.platformFees ?? null,
    totalRevenue: input.totalRevenue ?? null,
    cmCharges: input.cmCharges ?? null,
    maintInfraCharges: input.maintInfraCharges ?? null,
    centerCollections: input.centerCollections ?? null,
    midMonthPayment: input.midMonthPayment ?? null,
    tds: input.tds ?? null,
    grossPayable: input.grossPayable ?? null,
    notes: input.notes?.trim() || null,
    settlementDriveUrl: input.settlementDriveUrl?.trim() || null,
    taxInvoiceDriveUrl: input.taxInvoiceDriveUrl?.trim() || null,
    enteredByUserId: userId,
  };
}

export async function getCultSettlement(gymId: string, month: number, year: number) {
  const row = await prisma.cultSettlement.findUnique({
    where: { gymId_month_year: { gymId, month, year } },
  });
  return row ? serializeCultSettlement(row) : null;
}

export async function upsertCultSettlement(
  gymId: string,
  userId: string,
  input: CultSettlementInput
) {
  const row = await prisma.cultSettlement.upsert({
    where: {
      gymId_month_year: { gymId, month: input.month, year: input.year },
    },
    create: toCreateData(gymId, userId, input),
    update: {
      ...toUpdateData(input),
      enteredByUserId: userId,
    },
  });
  return serializeCultSettlement(row);
}

export async function mergeCultSettlement(
  gymId: string,
  userId: string,
  month: number,
  year: number,
  patch: Partial<CultSettlementInput>,
  options?: { overwriteUrls?: boolean; overwriteFigures?: boolean }
) {
  const existing = await prisma.cultSettlement.findUnique({
    where: { gymId_month_year: { gymId, month, year } },
  });

  const overwriteUrls = options?.overwriteUrls ?? false;
  const overwriteFigures = options?.overwriteFigures ?? false;

  const urlKeys = ["settlementDriveUrl", "taxInvoiceDriveUrl"] as const;
  const figureKeys = [
    "partnerShare",
    "taxInvoiceGrossTotal",
    "saleOfNewPacks",
    "walkInsOuts",
    "otherAdjustments",
    "platformFees",
    "totalRevenue",
    "cmCharges",
    "maintInfraCharges",
    "centerCollections",
    "midMonthPayment",
    "tds",
    "grossPayable",
    "periodStart",
    "periodEnd",
    "notes",
  ] as const;

  const merged: CultSettlementInput = { month, year };

  if (existing) {
    const current = serializeCultSettlement(existing);
    for (const key of figureKeys) {
      const incoming = patch[key];
      const already = current[key];
      if (incoming === undefined) continue;
      if (!overwriteFigures && already != null && already !== "") continue;
      (merged as Record<string, unknown>)[key] = incoming;
    }
    for (const key of urlKeys) {
      const incoming = patch[key];
      const already = current[key];
      if (!incoming) continue;
      if (!overwriteUrls && already) continue;
      merged[key] = incoming;
    }
    if (Object.keys(merged).length <= 2) {
      return current;
    }
    const row = await prisma.cultSettlement.update({
      where: { id: existing.id },
      data: {
        ...toPartialUpdate(merged),
        enteredByUserId: userId,
      },
    });
    return serializeCultSettlement(row);
  }

  return upsertCultSettlement(gymId, userId, { month, year, ...patch });
}

export async function deleteCultSettlement(gymId: string, id: string) {
  const existing = await prisma.cultSettlement.findFirst({ where: { id, gymId } });
  if (!existing) return null;
  await prisma.cultSettlement.delete({ where: { id } });
  return { id };
}
