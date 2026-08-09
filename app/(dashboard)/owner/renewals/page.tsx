import RenewalsPage from "@/components/renewals/renewals-list";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function OwnerRenewalsPage({ searchParams }: Props) {
  return <RenewalsPage searchParams={searchParams} />;
}
