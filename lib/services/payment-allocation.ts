/**
 * Add calendar months without overflowing into the next month
 * (29 Jan + 1 month → 28 Feb 2026, not 1 Mar).
 */
export function addCalendarMonths(date: Date, months: number): Date {
  const year = date.getFullYear();
  const monthIndex = date.getMonth() + months;
  const day = date.getDate();
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay), 12, 0, 0, 0);
}

/**
 * Split a lump-sum PT payment evenly across package months.
 * Each installment is attributed to a service month (for target/split calc)
 * and payable to the trainer the following month.
 */
export function allocateMonthlyInstallments(
  totalAmount: number,
  startDate: Date,
  monthsCount: number
): { amount: number; serviceDate: Date; payableDate: Date; installmentIndex: number }[] {
  const count = Math.max(1, monthsCount);
  const installments: {
    amount: number;
    serviceDate: Date;
    payableDate: Date;
    installmentIndex: number;
  }[] = [];

  let allocated = 0;
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const amount = isLast
      ? Math.round((totalAmount - allocated) * 100) / 100
      : Math.round((totalAmount / count) * 100) / 100;
    allocated += amount;

    const serviceDate = addCalendarMonths(startDate, i);
    const payableDate = new Date(
      serviceDate.getFullYear(),
      serviceDate.getMonth() + 1,
      1,
      12,
      0,
      0,
      0
    );

    installments.push({ amount, serviceDate, payableDate, installmentIndex: i });
  }

  return installments;
}

export function inferMonthsCount(startDate: Date, endDate: Date): number {
  const months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());
  return Math.max(1, months);
}
