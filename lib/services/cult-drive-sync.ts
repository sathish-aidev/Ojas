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
  getDriveFolderId,
} from "@/lib/sheet-config";
import { ensureFolder, uploadPdfToFolder } from "@/lib/google/drive-archive";
import { mergeCultSettlement, type CultSettlementInput } from "@/lib/services/cult-settlements";
import { validateCultSettlementParse, type ParsedCultPdf } from "@/lib/cult-pdf-parse";
import { fromYmd } from "@/lib/date-ymd";
import type { CultSettlement } from "@prisma/client";

function figuresFromPdf(parsed: ParsedCultPdf): Partial<CultSettlementInput> {
  const patch: Partial<CultSettlementInput> = {};
  const check = validateCultSettlementParse(parsed);
  // Partner Share is stored only after period + amount both parse.
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
  if (parsed.grossPayable != null) patch.grossPayable = parsed.grossPayable;
  if (parsed.periodStart) patch.periodStart = parsed.periodStart;
  if (parsed.periodEnd) patch.periodEnd = parsed.periodEnd;
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

function isSettlementLike(file: CultDriveFile) {
  return (
    file.kind === "settlement" ||
    /mnt\s*end|month\s*end|settlement|draft/i.test(file.name)
  );
}

function shouldParsePdf(file: CultDriveFile, row?: CultSettlement) {
  if (!file.mimeType.toLowerCase().includes("pdf")) return false;
  if (row?.partnerShare != null) return false;
  if (isSettlementLike(file)) return true;
  // No month in the filename: read the PDF period (e.g. From: 01-January-2026).
  if (!file.month || !file.year) return true;
  return file.kind !== "tax_invoice";
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

  for (const file of files) {
    const patch: Partial<CultSettlementInput> = {};
    let parsedPdf: ParsedCultPdf | undefined;
    const rowGuess =
      file.month && file.year ? byMonth.get(`${file.year}-${file.month}`) : undefined;

    if (parsePdfs && shouldParsePdf(file, rowGuess)) {
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
      isSettlementLike(file) ||
      (parsedPdf != null && validateCultSettlementParse(parsedPdf).ok);
    if (isSettlement) patch.settlementDriveUrl = file.webViewLink;
    else patch.taxInvoiceDriveUrl = file.webViewLink;

    await mergeCultSettlement(gymId, userId, key.month, key.year, patch);
    const saved = await prisma.cultSettlement.findUnique({
      where: { gymId_month_year: { gymId, month: key.month, year: key.year } },
    });
    if (saved) byMonth.set(`${key.year}-${key.month}`, saved);
    linked.push(file.name);
  }

  return {
    folders,
    files,
    linked: linked.length,
    parsed: parsedNames.length,
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

  if (file.mimeType.toLowerCase().includes("pdf")) {
    try {
      const result = await extractCultPdfFigures(file.id);
      const check = validateCultSettlementParse(result.parsed, month, year);
      Object.assign(patch, figuresFromPdf(result.parsed));
      if (check.ok || resolvedKind === "settlement") {
        patch.settlementDriveUrl = file.webViewLink;
      } else {
        patch.taxInvoiceDriveUrl = file.webViewLink;
      }
      await mergeCultSettlement(gymId, userId, month, year, patch, {
        overwriteUrls: true,
        overwriteFigures: check.ok,
      });
      return { warning: result.warning ?? null };
    } catch (err) {
      if (resolvedKind === "tax_invoice") patch.taxInvoiceDriveUrl = file.webViewLink;
      else patch.settlementDriveUrl = file.webViewLink;
      await mergeCultSettlement(gymId, userId, month, year, patch, { overwriteUrls: true });
      return {
        warning: err instanceof Error ? err.message : "Could not parse PDF; file linked only",
      };
    }
  }

  if (resolvedKind === "tax_invoice") patch.taxInvoiceDriveUrl = file.webViewLink;
  else patch.settlementDriveUrl = file.webViewLink;

  await mergeCultSettlement(gymId, userId, month, year, patch, { overwriteUrls: true });
  return { warning: null };
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export async function ingestCultSettlementPdf(
  gymId: string,
  userId: string,
  month: number,
  year: number,
  filename: string,
  buffer: Buffer,
  options?: { confirm?: boolean }
) {
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error("PDF is larger than 15 MB");
  }

  const result = await parseCultPdfBuffer(buffer);
  const check = validateCultSettlementParse(result.parsed);
  const targetMonth = check.month ?? month;
  const targetYear = check.year ?? year;

  if (!check.ok) {
    throw new Error(check.errors.join(". "));
  }

  const preview = {
    needsConfirm: true as const,
    month: targetMonth,
    year: targetYear,
    partnerShare: result.parsed.partnerShare,
    totalRevenue: result.parsed.totalRevenue,
    grossPayable: result.parsed.grossPayable,
    periodStart: result.parsed.periodStart,
    periodEnd: result.parsed.periodEnd,
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
    const settlementId = await ensureFolder(cultId, CULT_SETTLEMENT_FOLDER);
    driveUrl = await uploadPdfToFolder(settlementId, filename, buffer);
    patch.settlementDriveUrl = driveUrl;
  } catch (err) {
    driveWarning =
      err instanceof Error ? err.message : "Could not copy PDF to Drive; figures were still saved";
  }

  await mergeCultSettlement(gymId, userId, targetMonth, targetYear, patch, {
    overwriteUrls: Boolean(driveUrl),
    overwriteFigures: true,
  });

  const warnings = [result.warning, driveWarning].filter(Boolean);

  return {
    needsConfirm: false as const,
    month: targetMonth,
    year: targetYear,
    partnerShare: result.parsed.partnerShare,
    totalRevenue: result.parsed.totalRevenue,
    grossPayable: result.parsed.grossPayable,
    warning: warnings.length ? warnings.join(" ") : null,
  };
}
