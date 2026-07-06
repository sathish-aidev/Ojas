import { requireOwnerOrSupervisor } from "@/lib/session";
import { ClientDetailView } from "@/components/clients/client-detail";

export default async function SupervisorClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireOwnerOrSupervisor();
  const { id } = await params;
  return <ClientDetailView clientId={id} user={user} backHref="/supervisor/clients" />;
}
