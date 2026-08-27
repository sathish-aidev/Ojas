const MONTH_ALIASES: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export type CultInvoiceKind = "settlement" | "tax_invoice" | "unknown";

export const DEFAULT_CULT_GYM_LABEL = "Impackt Fitness (Gowlidoddi)";

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function classifyCultInvoiceName(name: string): CultInvoiceKind {
  const n = name.toLowerCase();
  const settlement =
    /settlement|mnt\s*end|month\s*end|mnt\.?\s*end|partner\s*share/.test(n);
  const tax = /tax\s*invoice|_tax invoice|invoice/.test(n);
  if (settlement && !tax) return "settlement";
  if (tax && !settlement) return "tax_invoice";
  if (settlement && tax) return /settlement|mnt/.test(n) ? "settlement" : "tax_invoice";
  return "unknown";
}

export function classifyCultInvoice(name: string, folderHint = ""): CultInvoiceKind {
  if (/tax[_\s-]*invoice/i.test(folderHint)) return "tax_invoice";
  if (/settlement/i.test(folderHint)) return "settlement";
  return classifyCultInvoiceName(name);
}

export function cultGymDriveLabel(gym?: { name: string; location: string | null } | null): string {
  if (!gym) return DEFAULT_CULT_GYM_LABEL;
  const blob = `${gym.name} ${gym.location ?? ""}`;
  if (/gowlidoddi/i.test(blob)) return DEFAULT_CULT_GYM_LABEL;
  const locationFirst = gym.location?.split(",")[0]?.trim() ?? "";
  const name = gym.name.replace(/\s+Hyderabad$/i, "").trim() || "Impackt Fitness";
  if (locationFirst && !/india|telangana|hyderabad/i.test(locationFirst)) {
    return `${name} (${locationFirst})`;
  }
  return DEFAULT_CULT_GYM_LABEL;
}

/** Drive names matching existing Cult files, e.g. Impackt Fitness (Gowlidoddi)_Apr'26_Mnt End.pdf */
export function cultInvoiceCanonicalName(
  kind: "settlement" | "tax_invoice",
  month: number,
  year: number,
  gymLabel = DEFAULT_CULT_GYM_LABEL
): string {
  const short = MONTH_SHORT[month - 1] ?? "Jan";
  const yy = String(year).slice(-2);
  if (kind === "settlement") {
    return `${gymLabel}_${short}'${yy}_Mnt End.pdf`;
  }
  return `${gymLabel}_${short}${year}_Tax Invoice.pdf`;
}

export function driveFileIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

function yearFromToken(token: string): number | null {
  if (/^\d{4}$/.test(token)) {
    const y = Number(token);
    return y >= 2020 && y <= 2100 ? y : null;
  }
  if (/^\d{2}$/.test(token)) {
    const y = 2000 + Number(token);
    return y >= 2020 && y <= 2099 ? y : null;
  }
  return null;
}

/** Parse month/year from names like Apr'26, Apr2026, 2026-04, April 2026. */
export function parseCultInvoiceFilename(
  name: string,
  modifiedTime?: string | null
): { month: number | null; year: number | null } {
  const stem = name
    .replace(/\.[^.]+$/, "")
    .replace(/[_]+/g, " ")
    .replace(/[‘’`´′ʼ]/g, "'")
    .replace(/'/g, " ");
  let month: number | null = null;
  let year: number | null = null;

  const iso = stem.match(/\b(20\d{2})[-/](\d{1,2})\b/);
  if (iso) {
    year = yearFromToken(iso[1]);
    const m = Number(iso[2]);
    if (m >= 1 && m <= 12) month = m;
  }

  const dmy = stem.match(/\b(\d{1,2})[-/](20\d{2})\b/);
  if (!month && dmy) {
    const m = Number(dmy[1]);
    if (m >= 1 && m <= 12) {
      month = m;
      year = yearFromToken(dmy[2]);
    }
  }

  const named = stem.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\b\.?\s*['’\-\s]?\s*(\d{2,4})?\b/i
  );
  if (named) {
    month = MONTH_ALIASES[named[1].toLowerCase()] ?? month;
    if (named[2]) year = yearFromToken(named[2]) ?? year;
  }

  const glued = stem.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)(20\d{2})\b/i
  );
  if (glued) {
    month = MONTH_ALIASES[glued[1].toLowerCase()] ?? month;
    year = yearFromToken(glued[2]) ?? year;
  }

  if (!year && modifiedTime) {
    const dt = new Date(modifiedTime);
    if (!Number.isNaN(dt.getTime())) year = dt.getFullYear();
  }

  return { month, year };
}
