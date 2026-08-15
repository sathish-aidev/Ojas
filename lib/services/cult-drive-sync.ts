import { prisma } from "@/lib/prisma";
import {
  extractCultPdfFigures,
  listCultInvoiceFiles,
  type CultDriveFile,
} from "@/lib/google/cult-invoices";
import { mergeCultSettlement, type CultSettlementInput } from "@/lib/services/cult-settlements";
import type { ParsedCultPdf } from "@/lib/cult-pdf-parse";

function figuresFromPdf(parsed: ParsedCultPdf, kind: CultDriveFile["kind"]): Partial<CultSettlementInput> {
  const patch: Partial<CultSettlementInput> = {};
  if (kind === "tax_invoice") {
    if (parsed.taxInvoiceGrossTotal != null) patch.taxInvoiceGrossTotal = parsed.taxInvoiceGrossTotal;
    else if (parsed.partnerShare != null) patch.taxInvoiceGrossTotal = parsed.partnerShare;
  } else {
    if (parsed.partnerShare != null) patch.partnerShare = parsed.partnerShare;
    if (parsed.taxInvoiceGrossTotal != null && kind !== "settlement") {
      patch.taxInvoiceGrossTotal = parsed.taxInvoiceGrossTotal;
    }
  }
  if (parsed.saleOfNewPacks != null) patch.saleOfNewPacks = parsed.saleOfNewPacks;
  if (parsed.walkInsOuts != null) patch.walkInsOuts = parsed.walkInsOuts;
  if (parsed.otherAdjustments != null) patch.otherAdjustments = parsed.otherAdjustments;
  if (parsed.platformFees != null) patch.platformFees = parsed.platformFees;
  if (parsed.totalRevenue != null) patch.totalRevenue = parsed.totalRevenue;
  if (parsed.cmCharges != null) patch.cmCharges = parsed.cmCharges;
  if (parsed.maintInfraCharges != null) patch.maintInfraCharges = parsed.maintInfraCharges;
  if (parsed.centerCollections != null) patch.centerCollections = parsed.centerCollections;
  if (parsed.midMonthPayment != null) patch.midMonthPayment = parsed.midMonthPayment;
  if (parsed.tds != null) patch.tds = parsed.tds;
  if (parsed.grossPayable != null) patch.grossPayable = parsed.grossPayable;
  if (parsed.periodStart) patch.periodStart = parsed.periodStart;
  if (parsed.periodEnd) patch.periodEnd = parsed.periodEnd;
  return patch;
}

export async function scanCultInvoicesFromDrive(
  gymId: string,
  userId: string,
  options?: { parsePdfs?: boolean }
) {
  const { folders, files } = await listCultInvoiceFiles();
  const parsePdfs = options?.parsePdfs ?? true;
  const existing = await prisma.cultSettlement.findMany({ where: { gymId } });
  const byMonth = new Map(existing.map((row) => [`${row.year}-${row.month}`, row]));
  const linked: string[] = [];
  const parsed: string[] = [];
  const warnings: string[] = [];
  const unmatched: CultDriveFile[] = [];

  for (const file of files) {
    if (!file.month || !file.year) {
      unmatched.push(file);
      continue;
    }

    const patch: Partial<CultSettlementInput> = {};
    if (file.kind === "tax_invoice") patch.taxInvoiceDriveUrl = file.webViewLink;
    else patch.settlementDriveUrl = file.webViewLink;

    const row = byMonth.get(`${file.year}-${file.month}`);
    const needsParse =
      file.kind === "tax_invoice" ? row?.taxInvoiceGrossTotal == null : row?.partnerShare == null;

    if (parsePdfs && needsParse && file.mimeType.toLowerCase().includes("pdf")) {
      try {
        const result = await extractCultPdfFigures(file.id);
        if (result.warning) warnings.push(`${file.name}: ${result.warning}`);
        Object.assign(patch, figuresFromPdf(result.parsed, file.kind));
        if (result.parsed.partnerShare != null || result.parsed.taxInvoiceGrossTotal != null) {
          parsed.push(file.name);
        }
      } catch (err) {
        warnings.push(
          `${file.name}: could not read PDF (${err instanceof Error ? err.message : "unknown"})`
        );
      }
    }

    await mergeCultSettlement(gymId, userId, file.month, file.year, patch);
    linked.push(file.name);
  }

  return {
    folders,
    files,
    linked: linked.length,
    parsed: parsed.length,
    unmatched,
    warnings,
  };
}

export async function attachCultFileToMonth(
  gymId: string,
  userId: string,
  file: CultDriveFile,
  month: number,
  year: number,
  kind?: CultDriveFile["kind"]
) {
  const resolvedKind = kind && kind !== "unknown" ? kind : file.kind;
  const patch: Partial<CultSettlementInput> = {};
  if (resolvedKind === "tax_invoice") patch.taxInvoiceDriveUrl = file.webViewLink;
  else patch.settlementDriveUrl = file.webViewLink;

  if (file.mimeType.toLowerCase().includes("pdf")) {
    try {
      const result = await extractCultPdfFigures(file.id);
      Object.assign(patch, figuresFromPdf(result.parsed, resolvedKind === "unknown" ? "settlement" : resolvedKind));
      await mergeCultSettlement(gymId, userId, month, year, patch, { overwriteUrls: true });
      return { warning: result.warning ?? null };
    } catch (err) {
      await mergeCultSettlement(gymId, userId, month, year, patch, { overwriteUrls: true });
      return {
        warning: err instanceof Error ? err.message : "Could not parse PDF; file linked only",
      };
    }
  }

  await mergeCultSettlement(gymId, userId, month, year, patch, { overwriteUrls: true });
  return { warning: null };
}
