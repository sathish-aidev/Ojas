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

export function ptListBadge(subEndDate: Date | string | null | undefined, now?: Date) {
  if (hasActivePt(subEndDate, now)) {
    return { label: "Active PT", variant: "success" as const };
  }
  return { label: "Ended", variant: "secondary" as const };
}

export function partitionClientsByActivePt<T extends { subEndDate?: Date | string | null }>(
  clients: T[],
  now?: Date
): { active: T[]; past: T[] } {
  const active: T[] = [];
  const past: T[] = [];
  for (const client of clients) {
    if (hasActivePt(client.subEndDate, now)) active.push(client);
    else past.push(client);
  }
  const endTime = (value: Date | string | null | undefined) => {
    if (!value) return 0;
    return new Date(value).getTime();
  };
  active.sort((a, b) => endTime(a.subEndDate) - endTime(b.subEndDate));
  past.sort((a, b) => endTime(b.subEndDate) - endTime(a.subEndDate));
  return { active, past };
}
