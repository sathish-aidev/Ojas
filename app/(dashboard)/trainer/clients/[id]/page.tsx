import { requireTrainer } from "@/lib/session";
import { ClientDetailView } from "@/components/clients/client-detail";

export default async function TrainerClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireTrainer();
  const { id } = await params;
  return <ClientDetailView clientId={id} user={user} backHref="/trainer/clients" />;
}
