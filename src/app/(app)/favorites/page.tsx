import { StarIcon } from "lucide-react";
import type { Metadata } from "next";
import { FavoritesView } from "@/components/favorites/favorites-view";
import { PageHeader, PageShell } from "@/components/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { requireSession } from "@/lib/auth";
import { listFavorites } from "@/server/favorites";

export const metadata: Metadata = { title: "Yêu thích" };

export default async function FavoritesPage() {
  const session = await requireSession();
  const favorites = await listFavorites(session);

  return (
    <PageShell>
      <PageHeader title="Yêu thích" description="Folder và file bạn đánh dấu sao. Chỉ mình bạn thấy danh sách này." />
      <FavoritesView
        favorites={favorites}
        empty={
          <Empty className="rounded-[18px] border border-dashed border-border py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="size-12 rounded-xl bg-card [&_svg]:size-6">
                <StarIcon />
              </EmptyMedia>
              <EmptyTitle className="font-display text-xl">Chưa có mục yêu thích</EmptyTitle>
              <EmptyDescription>
                Bấm biểu tượng sao trên folder hoặc file (phím S khi đang xem) để giữ chúng ở đây.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        }
      />
    </PageShell>
  );
}
