import { requireTrainer } from "@/lib/session";
import { ClientsListView } from "@/components/clients/clients-list";

export default async function TrainerClientsPage() {
  const user = await requireTrainer();
  return <ClientsListView user={user} basePath="/trainer/clients" />;
}
