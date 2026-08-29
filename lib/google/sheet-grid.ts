/** Parse the start cell of a Google Sheets A1 range, including quoted sheet names. */
export function parseA1RangeStart(range: string | null | undefined): { row: number; col: number } {
  if (!range) return { row: 1, col: 1 };
  const bang = range.lastIndexOf("!");
  const ref = bang >= 0 ? range.slice(bang + 1) : range;
  const start = ref.split(":")[0].replace(/\$/g, "").trim();
  const match = start.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return { row: 1, col: 1 };
  return { row: parseInt(match[2], 10), col: lettersToColumn(match[1]) };
}

function lettersToColumn(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n;
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

/**
 * values.get omits leading empty rows/columns. Pad so index 0 is sheet row 1 / column A.
 * Needed when Expenses is a Table starting at B3 instead of A1.
 */
export function padValuesToA1(values: unknown[][], range: string | null | undefined): string[][] {
  const { row, col } = parseA1RangeStart(range);
  const padded: string[][] = [];
  for (let i = 1; i < row; i++) padded.push([]);
  for (const line of values) {
    const cells = Array.from({ length: Math.max(0, col - 1) }, () => "");
    for (const value of line ?? []) cells.push(cellToString(value));
    padded.push(cells);
  }
  return padded;
}
