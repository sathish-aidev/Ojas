import { auth } from "@/lib/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-muted/30">
      <AppHeader user={session?.user} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:flex-row md:p-6">
        <AppSidebar role={session?.user?.role} />
        <main className="flex-1 pb-8">{children}</main>
      </div>
    </div>
  );
}
