import { parseGymCsv, type ParseGymCsvResult } from "./parse-gym-csv";

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

export function parseGymSheetRows(rows: string[][]): ParseGymCsvResult {
  return parseGymCsv(sheetRowsToCsv(rows));
}
