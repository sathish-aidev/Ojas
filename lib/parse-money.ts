/** Parse INR amounts from sheets/PDFs: 8,09,198 or ₹809198 or (15413). */
export function parseMoney(input: string | number | null | undefined): number | null {
  if (input == null || input === "") return null;
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) / 100 : null;
  }

  let text = input.trim();
  if (!text || text === "-") return null;

  const parenNegative = /^\(.*\)$/.test(text);
  text = text.replace(/₹/g, "").replace(/Rs\.?/gi, "").replace(/\s/g, "").replace(/,/g, "");
  if (parenNegative) text = text.replace(/[()]/g, "");

  const negative = parenNegative || text.startsWith("-") || text.startsWith("−");
  text = text.replace(/^[-−]/, "");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;

  const value = parseFloat(text);
  if (!Number.isFinite(value)) return null;
  const signed = negative ? -value : value;
  return Math.round(signed * 100) / 100;
}
