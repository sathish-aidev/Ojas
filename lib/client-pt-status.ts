/** Client has PT coverage through today or later (end date still in the future). */
export function hasActivePt(
  subEndDate: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!subEndDate) return false;
  const end = new Date(subEndDate);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return end >= today;
}
