import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { UploadPanel } from "@/components/upload/upload-panel";
import { UploadProvider } from "@/components/upload/upload-provider";
import { isAdmin, requireSession } from "@/lib/auth";
import { CURRENT_VERSION } from "@/lib/releases";
import { listRootFolders } from "@/server/queries";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const rootFolders = await listRootFolders(session);

  return (
    <SidebarProvider>
      <AppSidebar
        rootFolders={rootFolders}
        user={{
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
        }}
        isAdmin={isAdmin(session)}
        version={CURRENT_VERSION}
      />
      <UploadProvider>
        <SidebarInset>{children}</SidebarInset>
        <UploadPanel />
      </UploadProvider>
    </SidebarProvider>
  );
}
