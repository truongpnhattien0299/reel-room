import { AppSidebar } from "@/components/app-sidebar";
import { FavoritesProvider } from "@/components/favorites/favorites-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { UploadPanel } from "@/components/upload/upload-panel";
import { UploadProvider } from "@/components/upload/upload-provider";
import { isAdmin, requireSession } from "@/lib/auth";
import { CURRENT_VERSION } from "@/lib/releases";
import { listFavoriteIds } from "@/server/favorites";
import { listRootFolders } from "@/server/queries";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const [rootFolders, favoriteIds] = await Promise.all([listRootFolders(session), listFavoriteIds(session)]);

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
      <FavoritesProvider initial={favoriteIds}>
        <UploadProvider>
          <SidebarInset>{children}</SidebarInset>
          <UploadPanel />
        </UploadProvider>
      </FavoritesProvider>
    </SidebarProvider>
  );
}
