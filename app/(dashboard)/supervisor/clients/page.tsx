import { requireOwnerOrSupervisor } from "@/lib/session";
import { ClientsListView } from "@/components/clients/clients-list";

export default async function SupervisorClientsPage() {
  const user = await requireOwnerOrSupervisor();
  return <ClientsListView user={user} basePath="/supervisor/clients" />;
}
