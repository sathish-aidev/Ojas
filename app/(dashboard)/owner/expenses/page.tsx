import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OwnerExpensesPage({ searchParams }: Props) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  const month = params.month;
  const year = params.year;
  if (typeof month === "string") qs.set("month", month);
  if (typeof year === "string") qs.set("year", year);
  const suffix = qs.toString();
  redirect(`/owner/revenue${suffix ? `?${suffix}` : ""}#expenses`);
}
