import { BugIcon, SparklesIcon, TrendingUpIcon, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader, PageShell } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import {
  CHANGE_KINDS,
  CURRENT_VERSION,
  RELEASES,
  releaseDate,
  type ChangeKind,
  type Release,
} from "@/lib/releases";
import { cn } from "@/lib/utils";
import { ScrollToHash } from "./scroll-to-hash";

export const metadata: Metadata = { title: "Có gì mới" };

const KIND_ICON: Record<ChangeKind, { icon: LucideIcon; className: string }> = {
  feature: { icon: SparklesIcon, className: "text-primary" },
  improvement: { icon: TrendingUpIcon, className: "text-sky-400" },
  fix: { icon: BugIcon, className: "text-amber-400" },
};

export default function ReleasesPage() {
  return (
    <PageShell>
      <PageHeader
        title="Có gì mới"
        description={`Phiên bản hiện tại v${CURRENT_VERSION} · lịch sử thay đổi của ReelRoom.`}
      />
      <ol className="flex max-w-3xl flex-col gap-6">
        {RELEASES.map((r) => (
          <li key={r.version}>
            <ReleaseCard release={r} />
          </li>
        ))}
      </ol>
      <ScrollToHash />
    </PageShell>
  );
}

function ReleaseCard({ release: r }: { release: Release }) {
  const anchor = `v${r.version.replaceAll(".", "-")}`;
  const groups = CHANGE_KINDS.map((k) => ({
    ...k,
    items: r.changes.filter((c) => c.kind === k.kind),
  })).filter((g) => g.items.length > 0);

  return (
    <article
      id={anchor}
      aria-labelledby={`${anchor}-title`}
      className="flex scroll-mt-6 flex-col gap-5 rounded-[18px] bg-card p-5 ring-1 ring-border sm:p-6"
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono font-semibold">v{r.version}</span>
          {r.version === CURRENT_VERSION && <Badge>Hiện tại</Badge>}
          <span className="text-muted-foreground">·</span>
          <time dateTime={r.date} className="text-muted-foreground">
            {formatDate(releaseDate(r))}
          </time>
        </div>
        <h2
          id={`${anchor}-title`}
          className="font-display text-2xl font-semibold tracking-[-0.01em]"
        >
          {r.title}
        </h2>
        <p className="text-muted-foreground">{r.description}</p>
        <ul aria-label="Tóm tắt" className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <li key={g.kind}>
              <Badge variant="outline">
                <span className="font-mono">{g.items.length}</span> {g.label.toLowerCase()}
              </Badge>
            </li>
          ))}
        </ul>
      </header>
      {groups.map((g) => {
        const { icon: Icon, className } = KIND_ICON[g.kind];
        return (
          <section key={g.kind} className="flex flex-col gap-2 border-t border-[#1f2229] pt-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Icon className={cn("size-4", className)} aria-hidden="true" />
              {g.label}
            </h3>
            <ul className="flex list-disc flex-col gap-1.5 pl-6 text-[15px] marker:text-muted-foreground">
              {g.items.map((c) => (
                <li key={c.text}>{c.text}</li>
              ))}
            </ul>
          </section>
        );
      })}
    </article>
  );
}
