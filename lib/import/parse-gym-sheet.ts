import { parseGymCsv, type ParseGymCsvResult } from "./parse-gym-csv";
import { formatDateDMY, parseSheetDate } from "./parse-csv-dates";

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
  const headerIdx = rows.findIndex((row) => {
    const cells = row.map((c) => normalizeHeader(c ?? ""));
    return cells.includes("customer") && cells.includes("start date");
  });
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
