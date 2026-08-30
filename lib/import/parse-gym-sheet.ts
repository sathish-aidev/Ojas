import { parseGymCsv, gymRowIdentity, type ParseGymCsvResult } from "./parse-gym-csv";
import { formatDateDMY, parseSheetDate } from "./parse-csv-dates";
import { PT_SPREADSHEET_NAME, SHEET_HEADERS } from "@/lib/sheet-config";

/** Convert Google Sheets API values[][] into CSV text for the existing parser. */
export function sheetRowsToCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell ?? "";
          if (/[",\n\r]/.test(value)) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(",")
    )
    .join("\r\n");
}

function normalizeHeader(h: string): string {
  return h.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Turn serial / ISO date cells into DD/MM/YYYY before CSV parse. */
export function formatTrainerSheetDateCells(rows: string[][]): string[][] {
  const headerIdx = findTrainerHeaderIndex(rows);
  if (headerIdx < 0) return rows;
  const header = rows[headerIdx].map((c) => normalizeHeader(c ?? ""));
  const dateCols = header
    .map((h, i) => (h === "start date" || h === "end date" || h === "fee paid on" ? i : -1))
    .filter((i) => i >= 0);

  return rows.map((row, idx) => {
    if (idx <= headerIdx) return row;
    return row.map((cell, col) => {
      if (!dateCols.includes(col)) return cell;
      const parsed = parseSheetDate(cell);
      return parsed ? formatDateDMY(parsed) : cell;
    });
  });
}

export function parseGymSheetRows(rows: string[][]): ParseGymCsvResult {
  return parseGymCsv(sheetRowsToCsv(formatTrainerSheetDateCells(rows)));
}

function isBlankSheetRow(row: string[] | undefined): boolean {
  return !row || row.every((c) => !(c ?? "").trim());
}

function findTrainerHeaderIndex(rows: string[][]): number {
  return rows.findIndex((row) => {
    const cells = row.map((c) => normalizeHeader(c ?? ""));
    return cells.includes("start date") && (cells.includes("customer") || cells.includes("end date"));
  });
}

/**
 * Title on row 1, column headers on row 2, first client on row 3.
 * Keeps every non-blank data row as-is (no date rewriting).
 */
export function realignTrainerSheetRows(rows: string[][], trainerName: string): string[][] {
  const headerIdx = findTrainerHeaderIndex(rows);
  if (headerIdx < 0) {
    throw new Error(`Could not find Customer / Start Date header on ${trainerName}`);
  }
  const data = rows.slice(headerIdx + 1).filter((row) => !isBlankSheetRow(row));
  const first = (rows[0]?.[0] ?? "").trim();
  const title = /trainer:|pt tracker/i.test(first)
    ? first
    : `${PT_SPREADSHEET_NAME} | Trainer: ${trainerName} | Master copy — source of truth | Dates: DD/MM/YYYY`;
  return [[title], [...SHEET_HEADERS], ...data];
}

export function trainerSheetClientKeys(rows: string[][]): string[] {
  return parseGymSheetRows(rows).rows.map(gymRowIdentity).sort();
}
