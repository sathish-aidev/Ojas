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
  grossPayable: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  textLength: number;
};

function moneyAfter(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  if (!match) return null;
  const raw = match[1] ?? match[2] ?? match[3];
  return parseMoney(raw);
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

export function parseCultPdfText(text: string): ParsedCultPdf {
  const compact = text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");

  const period = compact.match(
    /From:\s*(\d{1,2}[-/][A-Za-z0-9]+[-/]\d{4})\s*To:\s*(\d{1,2}[-/][A-Za-z0-9]+[-/]\d{4})/i
  );

  return {
    partnerShare:
      moneyAfter(
        compact,
        /Amount Payable to Gym Partner(?:\s*\(Partner Share\))?[^\d\-]*([\d,]+(?:\.\d+)?)/i
      ) ?? moneyAfter(compact, /(?:\(|\b)Partner Share\)?[^\d\-]*([\d,]+(?:\.\d+)?)/i),
    taxInvoiceGrossTotal:
      moneyAfter(compact, /Gross Total[^\d\-]*([\d,]+(?:\.\d+)?)/i) ??
      moneyAfter(compact, /Grand Total[^\d\-]*([\d,]+(?:\.\d+)?)/i),
    saleOfNewPacks: moneyAfter(compact, /Sale of New Packs[^\d\-]*([\d,]+(?:\.\d+)?)/i),
    walkInsOuts: moneyAfter(
      compact,
      /Walk In'?s?\s*&\s*Walk Out'?s?[^\d\-]*([\d,]+(?:\.\d+)?)/i
    ),
    otherAdjustments: moneyAfter(compact, /Other Adjustment'?s?[^\d\-]*([\d,]+(?:\.\d+)?)/i),
    platformFees: moneyAfter(compact, /Platform Fee'?s?[^\d\-]*(-?[\d,]+(?:\.\d+)?)/i),
    totalRevenue:
      moneyAfter(compact, /1\s*Total Revenue[^\d\-]*([\d,]+(?:\.\d+)?)/i) ??
      moneyAfter(compact, /Total Revenue[^\d\-]*([\d,]+(?:\.\d+)?)/i),
    cmCharges: moneyAfter(compact, /CM Charges[^\d\-]*(-?[\d,]+(?:\.\d+)?)/i),
    maintInfraCharges: moneyAfter(
      compact,
      /Maint\/Infra Charges[^\d\-]*(-?[\d,]+(?:\.\d+)?)/i
    ),
    centerCollections: moneyAfter(
      compact,
      /Amount Collected At(?: the)? center[^\d\-]*(-?[\d,]+(?:\.\d+)?)/i
    ),
    midMonthPayment: moneyAfter(compact, /Mid-Month Payment[^\d\-]*(-?[\d,]+(?:\.\d+)?)/i),
    tds: moneyAfter(
      compact,
      /Expected TDS[^%\n]*\d+\s*%[^\d\-]*(-?[\d,]+(?:\.\d+)?)/i
    ),
    grossPayable: moneyAfter(compact, /Gross Payable[^\d\-]*(-?[\d,]+(?:\.\d+)?)/i),
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
