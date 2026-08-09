/** PDF-safe formatting — Helvetica cannot render the ₹ symbol (shows as "1"). */

export function formatPdfCurrency(amount: number | string): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
  return `Rs. ${formatted}`;
}

export function formatGymDisplayName(gymName: string): string {
  return `${gymName} — Gowlidoddi branch`;
}
