import { requireOwner } from "@/lib/session";
import { ClientDetailView } from "@/components/clients/client-detail";

export default async function OwnerClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireOwner();
  const { id } = await params;
  return <ClientDetailView clientId={id} user={user} backHref="/owner/clients" />;
}
