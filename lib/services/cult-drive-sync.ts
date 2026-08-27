import { prisma } from "@/lib/prisma";
import {
  extractCultPdfFigures,
  listCultInvoiceFiles,
  parseCultPdfBuffer,
  type CultDriveFile,
} from "@/lib/google/cult-invoices";
import {
  CULT_INVOICES_FOLDER,
  CULT_SETTLEMENT_FOLDER,
  CULT_TAX_INVOICE_FOLDER,
  getDriveFolderId,
} from "@/lib/sheet-config";
import {
  ensureFolder,
  renameDriveFile,
  uploadOrReplacePdfInFolder,
} from "@/lib/google/drive-archive";
import { mergeCultSettlement, type CultSettlementInput } from "@/lib/services/cult-settlements";
import {
  validateCultSettlementParse,
  validateCultTaxInvoiceParse,
  type ParsedCultPdf,
} from "@/lib/cult-pdf-parse";
import {
  cultGymDriveLabel,
  cultInvoiceCanonicalName,
  driveFileIdFromUrl,
  parseCultInvoiceFilename,
} from "@/lib/cult-invoice-parse";
import { fromYmd } from "@/lib/date-ymd";
import type { CultSettlement } from "@prisma/client";

export type ProcessedCultMonth = {
  month: number;
  year: number;
  kind: "settlement" | "tax_invoice";
  fileName: string;
  partnerShare: number | null;
  taxInvoiceGrossTotal: number | null;
};

function figuresFromPdf(parsed: ParsedCultPdf): Partial<CultSettlementInput> {
  const patch: Partial<CultSettlementInput> = {};
  const check = validateCultSettlementParse(parsed);
  if (check.ok && parsed.partnerShare != null) patch.partnerShare = parsed.partnerShare;
  if (parsed.taxInvoiceGrossTotal != null) patch.taxInvoiceGrossTotal = parsed.taxInvoiceGrossTotal;
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
  if (parsed.leasingEmi != null) patch.leasingEmi = parsed.leasingEmi;
  if (parsed.grossPayable != null) patch.grossPayable = parsed.grossPayable;
  if (parsed.periodStart) patch.periodStart = parsed.periodStart;
  if (parsed.periodEnd) patch.periodEnd = parsed.periodEnd;
  if (check.ok) {
    patch.leasingEmi = parsed.leasingEmi ?? 0;
  }
  return patch;
}

function monthYearFromParsed(
  file: CultDriveFile,
  parsed?: ParsedCultPdf
): { month: number; year: number } | null {
  if (parsed?.periodStart) {
    const d = fromYmd(parsed.periodStart);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  }
  if (file.month && file.year) return { month: file.month, year: file.year };
  return null;
}

export function resolvedCultKind(file: CultDriveFile): "settlement" | "tax_invoice" | "unknown" {
  if (file.kind === "settlement" || file.kind === "tax_invoice") return file.kind;
  if (/mnt\s*end|month\s*end|settlement|draft/i.test(file.name)) return "settlement";
  if (/invoice/i.test(file.name)) return "tax_invoice";
  return "unknown";
}

export function isNewCultDriveFile(
  file: CultDriveFile,
  row: CultSettlement | undefined,
  kind: "settlement" | "tax_invoice"
): boolean {
  const url = kind === "settlement" ? row?.settlementDriveUrl : row?.taxInvoiceDriveUrl;
  const linkedId = driveFileIdFromUrl(url);
  return linkedId !== file.id;
}

function shouldParsePdf(
  file: CultDriveFile,
  row: CultSettlement | undefined,
  kind: "settlement" | "tax_invoice" | "unknown"
) {
  if (!file.mimeType.toLowerCase().includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
    return false;
  }
  if (kind === "settlement") {
    return true;
  }
  if (kind === "tax_invoice") {
    return !row || row.taxInvoiceGrossTotal == null || isNewCultDriveFile(file, row, "tax_invoice");
  }
  return !row || row.partnerShare == null;
}

async function gymLabelFor(gymId: string) {
  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    select: { name: true, location: true },
  });
  return cultGymDriveLabel(gym);
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
  const parsedNames: string[] = [];
  const warnings: string[] = [];
  const unmatched: CultDriveFile[] = [];
  const processed: ProcessedCultMonth[] = [];
  const gymLabel = await gymLabelFor(gymId);

  const ordered = [...files].sort((a, b) => {
    const rank = (file: CultDriveFile) => (resolvedCultKind(file) === "settlement" ? 1 : 0);
    return rank(a) - rank(b);
  });

  for (const file of ordered) {
    const patch: Partial<CultSettlementInput> = {};
    let parsedPdf: ParsedCultPdf | undefined;
    const kind = resolvedCultKind(file);
    const rowGuess =
      file.month && file.year ? byMonth.get(`${file.year}-${file.month}`) : undefined;

    if (parsePdfs && shouldParsePdf(file, rowGuess, kind)) {
      try {
        const result = await extractCultPdfFigures(file.id);
        parsedPdf = result.parsed;
        if (result.warning) warnings.push(`${file.name}: ${result.warning}`);
        Object.assign(patch, figuresFromPdf(result.parsed));
        if (result.parsed.partnerShare != null || result.parsed.taxInvoiceGrossTotal != null) {
          parsedNames.push(file.name);
        }
      } catch (err) {
        warnings.push(
          `${file.name}: could not read PDF (${err instanceof Error ? err.message : "unknown"})`
        );
      }
    }

    const key = monthYearFromParsed(file, parsedPdf);
    if (!key) {
      unmatched.push(file);
      continue;
    }

    const isSettlement =
      kind === "tax_invoice"
        ? false
        : kind === "settlement" ||
          (parsedPdf != null && validateCultSettlementParse(parsedPdf).ok);
    if (isSettlement) patch.settlementDriveUrl = file.webViewLink;
    else patch.taxInvoiceDriveUrl = file.webViewLink;

    const row = byMonth.get(`${key.year}-${key.month}`);
    const newFile = isNewCultDriveFile(
      file,
      row,
      isSettlement ? "settlement" : "tax_invoice"
    );
    const settlementCheck = parsedPdf ? validateCultSettlementParse(parsedPdf) : { ok: false };
    const overwriteFigures = Boolean(
      parsedPdf &&
        ((isSettlement && settlementCheck.ok) ||
          (!isSettlement && parsedPdf.taxInvoiceGrossTotal != null && newFile))
    );
    await mergeCultSettlement(gymId, userId, key.month, key.year, patch, {
      overwriteUrls: true,
      overwriteFigures,
    });
    const saved = await prisma.cultSettlement.findUnique({
      where: { gymId_month_year: { gymId, month: key.month, year: key.year } },
    });
    if (saved) byMonth.set(`${key.year}-${key.month}`, saved);
    linked.push(file.name);

    if (
      parsedPdf &&
      (patch.partnerShare != null || patch.taxInvoiceGrossTotal != null || overwriteFigures)
    ) {
      processed.push({
        month: key.month,
        year: key.year,
        kind: isSettlement ? "settlement" : "tax_invoice",
        fileName: file.name,
        partnerShare: parsedPdf.partnerShare,
        taxInvoiceGrossTotal: parsedPdf.taxInvoiceGrossTotal,
      });
    }

    if (parsedPdf && (isSettlement || kind === "tax_invoice")) {
      const canonical = cultInvoiceCanonicalName(
        isSettlement ? "settlement" : "tax_invoice",
        key.month,
        key.year,
        gymLabel
      );
      if (file.name !== canonical) {
        try {
          await renameDriveFile(file.id, canonical);
          file.name = canonical;
        } catch (err) {
          warnings.push(
            `${file.name}: linked but could not rename (${err instanceof Error ? err.message : "unknown"})`
          );
        }
      }
    }
  }

  processed.sort((a, b) => a.year - b.year || a.month - b.month);

  return {
    folders,
    files,
    linked: linked.length,
    parsed: parsedNames.length,
    unmatched,
    warnings,
    processed,
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
  const resolvedKind = kind && kind !== "unknown" ? kind : resolvedCultKind(file);
  const patch: Partial<CultSettlementInput> = {};

  if (file.mimeType.toLowerCase().includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) {
    try {
      const result = await extractCultPdfFigures(file.id);
      const check = validateCultSettlementParse(result.parsed, month, year);
      Object.assign(patch, figuresFromPdf(result.parsed));
      if (resolvedKind === "tax_invoice") {
        patch.taxInvoiceDriveUrl = file.webViewLink;
      } else if (check.ok || resolvedKind === "settlement") {
        patch.settlementDriveUrl = file.webViewLink;
      } else {
        patch.taxInvoiceDriveUrl = file.webViewLink;
      }
      await mergeCultSettlement(gymId, userId, month, year, patch, {
        overwriteUrls: true,
        overwriteFigures:
          resolvedKind === "tax_invoice"
            ? validateCultTaxInvoiceParse(result.parsed).ok
            : check.ok,
      });
      return { warning: result.warning ?? null, month, year };
    } catch (err) {
      if (resolvedKind === "tax_invoice") patch.taxInvoiceDriveUrl = file.webViewLink;
      else patch.settlementDriveUrl = file.webViewLink;
      await mergeCultSettlement(gymId, userId, month, year, patch, { overwriteUrls: true });
      return {
        warning: err instanceof Error ? err.message : "Could not parse PDF; file linked only",
        month,
        year,
      };
    }
  }

  if (resolvedKind === "tax_invoice") patch.taxInvoiceDriveUrl = file.webViewLink;
  else patch.settlementDriveUrl = file.webViewLink;

  await mergeCultSettlement(gymId, userId, month, year, patch, { overwriteUrls: true });
  return { warning: null, month, year };
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export async function ingestCultInvoicePdf(
  gymId: string,
  userId: string,
  month: number,
  year: number,
  filename: string,
  buffer: Buffer,
  kind: "settlement" | "tax_invoice",
  options?: { confirm?: boolean }
) {
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error("PDF is larger than 15 MB");
  }

  const result = await parseCultPdfBuffer(buffer);
  const gymLabel = await gymLabelFor(gymId);
  let targetMonth = month;
  let targetYear = year;
  if (result.parsed.periodStart) {
    const d = fromYmd(result.parsed.periodStart);
    targetMonth = d.getMonth() + 1;
    targetYear = d.getFullYear();
  } else {
    const fromName = parseCultInvoiceFilename(filename);
    if (fromName.month && fromName.year) {
      targetMonth = fromName.month;
      targetYear = fromName.year;
    }
  }

  if (kind === "settlement") {
    const check = validateCultSettlementParse(result.parsed);
    if (!check.ok) {
      throw new Error(check.errors.join(". "));
    }
    targetMonth = check.month ?? targetMonth;
    targetYear = check.year ?? targetYear;
  }

  const canonical = cultInvoiceCanonicalName(kind, targetMonth, targetYear, gymLabel);
  const preview = {
    needsConfirm: true as const,
    kind,
    month: targetMonth,
    year: targetYear,
    partnerShare: result.parsed.partnerShare,
    taxInvoiceGrossTotal: result.parsed.taxInvoiceGrossTotal,
    totalRevenue: result.parsed.totalRevenue,
    grossPayable: result.parsed.grossPayable,
    tds: result.parsed.tds,
    leasingEmi: result.parsed.leasingEmi,
    periodStart: result.parsed.periodStart,
    periodEnd: result.parsed.periodEnd,
    canonicalName: canonical,
    warning: result.warning ?? null,
  };

  if (!options?.confirm) {
    return preview;
  }

  const patch: Partial<CultSettlementInput> = {
    ...figuresFromPdf(result.parsed),
  };

  let driveUrl: string | null = null;
  let driveWarning: string | null = null;
  try {
    const rootId = getDriveFolderId();
    const cultId = await ensureFolder(rootId, CULT_INVOICES_FOLDER);
    const folderName = kind === "settlement" ? CULT_SETTLEMENT_FOLDER : CULT_TAX_INVOICE_FOLDER;
    const destId = await ensureFolder(cultId, folderName);
    driveUrl = await uploadOrReplacePdfInFolder(destId, canonical, buffer);
    if (kind === "settlement") patch.settlementDriveUrl = driveUrl;
    else patch.taxInvoiceDriveUrl = driveUrl;
  } catch (err) {
    driveWarning =
      err instanceof Error ? err.message : "Could not copy PDF to Drive; figures were still saved";
  }

  await mergeCultSettlement(gymId, userId, targetMonth, targetYear, patch, {
    overwriteUrls: Boolean(driveUrl),
    overwriteFigures: kind === "settlement" || validateCultTaxInvoiceParse(result.parsed).ok,
  });

  const warnings = [result.warning, driveWarning].filter(Boolean);

  return {
    needsConfirm: false as const,
    kind,
    month: targetMonth,
    year: targetYear,
    partnerShare: result.parsed.partnerShare,
    taxInvoiceGrossTotal: result.parsed.taxInvoiceGrossTotal,
    totalRevenue: result.parsed.totalRevenue,
    grossPayable: result.parsed.grossPayable,
    tds: result.parsed.tds,
    leasingEmi: result.parsed.leasingEmi,
    canonicalName: canonical,
    warning: warnings.length ? warnings.join(" ") : null,
  };
}

export async function ingestCultSettlementPdf(
  gymId: string,
  userId: string,
  month: number,
  year: number,
  filename: string,
  buffer: Buffer,
  options?: { confirm?: boolean }
) {
  return ingestCultInvoicePdf(gymId, userId, month, year, filename, buffer, "settlement", options);
}
