import { requireOwner } from "@/lib/session";
import { ClientsListView } from "@/components/clients/clients-list";

export default async function OwnerClientsPage() {
  const user = await requireOwner();
  return <ClientsListView user={user} basePath="/owner/clients" />;
}
