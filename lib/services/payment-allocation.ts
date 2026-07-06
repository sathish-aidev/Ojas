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

    const serviceDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + i,
      startDate.getDate(),
      12,
      0,
      0,
      0
    );
    const payableDate = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + i + 1,
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
