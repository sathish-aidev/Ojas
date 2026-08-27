import { parseMoney } from "@/lib/parse-money";
import { fromYmd } from "@/lib/date-ymd";

export type ParsedCultPdf = {
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
  leasingEmi: number | null;
  otherRecoveries: number | null;
  grossPayable: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  textLength: number;
};

function absAmount(value: number | null): number | null {
  if (value == null) return null;
  return Math.abs(value);
}

function toIsoDate(raw: string): string | null {
  const named = raw.match(/^(\d{1,2})[-/]([A-Za-z]+)[-/](\d{4})$/);
  if (named) {
    const months: Record<string, string> = {
      january: "01",
      february: "02",
      march: "03",
      april: "04",
      may: "05",
      june: "06",
      july: "07",
      august: "08",
      september: "09",
      october: "10",
      november: "11",
      december: "12",
    };
    const mm = months[named[2].toLowerCase()];
    if (!mm) return null;
    const iso = `${named[3]}-${mm}-${named[1].padStart(2, "0")}`;
    try {
      fromYmd(iso);
      return iso;
    } catch {
      return null;
    }
  }
  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return null;
}

/** Last INR amount on a settlement line. A trailing hyphen with no digits is 0 (blank Less: row). */
export function lastMoneyOnLine(line: string): number | null {
  const cleaned = line
    .replace(/\u00a0/g, " ")
    .replace(/@\s*\d+(?:\.\d+)?\s*%/g, "")
    .replace(/\d+(?:\.\d+)?\s*%/g, "")
    .trim();
  if (!cleaned) return null;
  if (/[-–—]\s*$/.test(cleaned) && !/-[\d,]+\s*$/.test(cleaned)) return 0;
  const matches = [...cleaned.matchAll(/-?[\d,]+(?:\.\d+)?/g)];
  if (!matches.length) return null;
  return absAmount(parseMoney(matches[matches.length - 1][0]));
}

function findLineAmount(lines: string[], test: (line: string) => boolean): number | null {
  const line = lines.find(test);
  if (!line) return null;
  return lastMoneyOnLine(line);
}

export function parseCultPdfText(text: string): ParsedCultPdf {
  const compact = text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
  const lines = compact
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const period = compact.match(
    /From:\s*(\d{1,2}[-/][A-Za-z0-9]+[-/]\d{4})\s*To:\s*(\d{1,2}[-/][A-Za-z0-9]+[-/]\d{4})/i
  );

  const knownLess =
    /collected at(?: the)? center|mid-month payment|expected tds|leasing emi/i;
  const otherRecoveries = lines
    .filter((line) => /less:/i.test(line) && !knownLess.test(line))
    .reduce((sum, line) => sum + (lastMoneyOnLine(line) ?? 0), 0);

  return {
    partnerShare: findLineAmount(lines, (line) =>
      /amount payable to gym partner|partner share/i.test(line)
    ),
    taxInvoiceGrossTotal:
      findLineAmount(lines, (line) => /^gross total\b/i.test(line)) ??
      findLineAmount(lines, (line) => /\bgross total\b/i.test(line)) ??
      findLineAmount(lines, (line) => /\bgrand total\b/i.test(line)),
    saleOfNewPacks: findLineAmount(lines, (line) => /sale of new packs/i.test(line)),
    walkInsOuts: findLineAmount(lines, (line) => /walk in'?s?\s*&\s*walk out/i.test(line)),
    otherAdjustments: findLineAmount(lines, (line) => /other adjustment/i.test(line)),
    platformFees: findLineAmount(lines, (line) => /platform fee/i.test(line)),
    totalRevenue:
      findLineAmount(lines, (line) => /^\d+\s+total revenue\b/i.test(line)) ??
      findLineAmount(lines, (line) => /\btotal revenue\b/i.test(line)),
    cmCharges: findLineAmount(lines, (line) => /\bcm charges\b/i.test(line)),
    maintInfraCharges: findLineAmount(lines, (line) => /maint\/infra charges/i.test(line)),
    centerCollections: findLineAmount(lines, (line) =>
      /collected at(?: the)? center/i.test(line)
    ),
    midMonthPayment: findLineAmount(lines, (line) => /mid-month payment/i.test(line)),
    tds: findLineAmount(lines, (line) => /expected tds/i.test(line)),
    leasingEmi: findLineAmount(lines, (line) => /leasing emi/i.test(line)),
    otherRecoveries: otherRecoveries > 0 ? otherRecoveries : 0,
    grossPayable: findLineAmount(
      lines,
      (line) => /^\d+\s+gross payable\b/i.test(line) || /^gross payable\b/i.test(line)
    ),
    periodStart: period ? toIsoDate(period[1]) : null,
    periodEnd: period ? toIsoDate(period[2]) : null,
    textLength: compact.trim().length,
  };
}

export type CultSettlementValidation = {
  ok: boolean;
  month: number | null;
  year: number | null;
  partnerShare: number | null;
  errors: string[];
};

/** Settlement PDFs are only confirmed when Partner Share and period both parse. */
export function validateCultSettlementParse(
  parsed: ParsedCultPdf,
  expectedMonth?: number,
  expectedYear?: number
): CultSettlementValidation {
  const errors: string[] = [];
  let month: number | null = null;
  let year: number | null = null;

  if (parsed.periodStart) {
    const d = fromYmd(parsed.periodStart);
    month = d.getMonth() + 1;
    year = d.getFullYear();
  } else {
    errors.push("Settlement period (From/To) was not found in the PDF");
  }

  if (parsed.partnerShare == null || parsed.partnerShare <= 0) {
    errors.push("Partner Share was not found in the PDF");
  }

  if (
    expectedMonth &&
    expectedYear &&
    month != null &&
    year != null &&
    (month !== expectedMonth || year !== expectedYear)
  ) {
    errors.push(
      `PDF period is ${String(month).padStart(2, "0")}/${year}, not ${String(expectedMonth).padStart(2, "0")}/${expectedYear}`
    );
  }

  return {
    ok: errors.length === 0,
    month,
    year,
    partnerShare: parsed.partnerShare,
    errors,
  };
}

export function validateCultTaxInvoiceParse(parsed: ParsedCultPdf): {
  ok: boolean;
  taxInvoiceGrossTotal: number | null;
  errors: string[];
} {
  const errors: string[] = [];
  if (parsed.taxInvoiceGrossTotal == null || parsed.taxInvoiceGrossTotal <= 0) {
    errors.push("Tax invoice Gross Total was not found in the PDF");
  }
  return {
    ok: errors.length === 0,
    taxInvoiceGrossTotal: parsed.taxInvoiceGrossTotal,
    errors,
  };
}
