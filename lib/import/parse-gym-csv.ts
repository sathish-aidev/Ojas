import { parseFlexibleDate } from "./parse-csv-dates";
import { parseFeePaidOn } from "./parse-fee-paid";
import { mapPaymentMode } from "./map-payment-mode";
import { inferMonthsCount } from "@/lib/services/payment-allocation";

export type ParsedGymRow = {
  rowNumber: number;
  customer: string;
  startDate: Date;
  endDate: Date;
  paymentDate: Date;
  amount: number;
  monthsCount: number;
  paymentMode: ReturnType<typeof mapPaymentMode>["mode"];
  paymentNotes: string;
  warnings: string[];
};

export type ParseGymCsvResult = {
  rows: ParsedGymRow[];
  errors: { rowNumber: number; message: string }[];
  headerRowIndex: number;
};

/** RFC4180-style CSV parser (handles quoted fields with embedded newlines). */
export function parseCsvRecords(content: string): string[][] {
  const text = content.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r" && next === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
      i++;
    } else if (ch === "\n" || ch === "\r") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  return records;
}

function normalizeHeader(h: string): string {
  return h.replace(/\s+/g, " ").trim().toLowerCase();
}

function findColumnIndex(headers: string[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = normalizeHeader(headers[i]);
    if (patterns.some((p) => p.test(h))) return i;
  }
  return -1;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[₹,\s]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseMonths(raw: string): number | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isBlankRow(cells: string[]): boolean {
  return cells.every((c) => !c.trim());
}

export function parseGymCsv(content: string): ParseGymCsvResult {
  const records = parseCsvRecords(content);
  const errors: { rowNumber: number; message: string }[] = [];
  const rows: ParsedGymRow[] = [];

  let headerRowIndex = -1;
  let colCustomer = -1;
  let colStart = -1;
  let colEnd = -1;
  let colFeePaid = -1;
  let colAmount = -1;
  let colMonths = -1;
  let colMode = -1;

  for (let i = 0; i < records.length; i++) {
    const cells = records[i];
    if (isBlankRow(cells)) continue;

    const headers = cells.map((c) => c.trim());
    const customerIdx = findColumnIndex(headers, [/^customer$/]);
    const startIdx = findColumnIndex(headers, [/^start date$/]);

    if (customerIdx >= 0 && startIdx >= 0) {
      headerRowIndex = i;
      colCustomer = customerIdx;
      colStart = startIdx;
      colEnd = findColumnIndex(headers, [/^end date$/]);
      colFeePaid = findColumnIndex(headers, [/^fee paid on$/]);
      colAmount = findColumnIndex(headers, [/^amount$/]);
      colMonths = findColumnIndex(headers, [/^months$/]);
      colMode = findColumnIndex(headers, [/^mode of payment$/]);
      break;
    }
  }

  if (headerRowIndex < 0) {
    errors.push({ rowNumber: 0, message: "Could not find header row with Customer and Start Date columns" });
    return { rows, errors, headerRowIndex: -1 };
  }

  if (colEnd < 0 || colAmount < 0 || colMonths < 0) {
    errors.push({
      rowNumber: headerRowIndex + 1,
      message: "Missing required columns: End Date, Amount, or Months",
    });
    return { rows, errors, headerRowIndex };
  }

  for (let i = headerRowIndex + 1; i < records.length; i++) {
    const cells = records[i];
    if (isBlankRow(cells)) continue;

    const rowNumber = i + 1;
    const customer = (cells[colCustomer] ?? "").trim();
    if (!customer) continue;

    const startRaw = (cells[colStart] ?? "").trim();
    const endRaw = (cells[colEnd] ?? "").trim();
    const amountRaw = (cells[colAmount] ?? "").trim();
    const monthsRaw = (cells[colMonths] ?? "").trim();
    const feePaidRaw = colFeePaid >= 0 ? (cells[colFeePaid] ?? "").trim() : "";
    const modeRaw = colMode >= 0 ? (cells[colMode] ?? "").trim() : "";

    const startDate = parseFlexibleDate(startRaw);
    const endDate = parseFlexibleDate(endRaw);
    const amount = parseAmount(amountRaw);
    const monthsCount = parseMonths(monthsRaw);

    if (!startDate) {
      errors.push({ rowNumber, message: `Invalid start date: "${startRaw}" (${customer})` });
      continue;
    }
    if (!endDate) {
      errors.push({ rowNumber, message: `Invalid end date: "${endRaw}" (${customer})` });
      continue;
    }
    if (amount === null || amount <= 0) {
      errors.push({ rowNumber, message: `Invalid amount: "${amountRaw}" (${customer})` });
      continue;
    }
    if (monthsCount === null) {
      errors.push({ rowNumber, message: `Invalid months: "${monthsRaw}" (${customer})` });
      continue;
    }

    const warnings: string[] = [];
    const inferredMonths = inferMonthsCount(startDate, endDate);
    if (inferredMonths !== monthsCount) {
      warnings.push(
        `Months=${monthsCount} but date span suggests ${inferredMonths} (${startRaw} → ${endRaw})`
      );
    }
    if (startDate.getTime() === endDate.getTime()) {
      warnings.push(`Start date equals end date (${startRaw})`);
    }

    const { paymentDate, usedStartDateFallback } = parseFeePaidOn(feePaidRaw, startDate);
    if (usedStartDateFallback && feePaidRaw && !/^\d/.test(feePaidRaw.trim())) {
      warnings.push(`Fee paid on "${feePaidRaw}" → using start date ${startRaw}`);
    }

    const { mode, notes } = mapPaymentMode(modeRaw);

    rows.push({
      rowNumber,
      customer,
      startDate,
      endDate,
      paymentDate,
      amount,
      monthsCount,
      paymentMode: mode,
      paymentNotes: notes,
      warnings,
    });
  }

  return { rows, errors, headerRowIndex };
}
