import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One headline number with a line of context under it. */
export function StorageTile({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5 rounded-[18px] bg-card p-5 ring-1 ring-border", className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-display text-[28px] leading-none font-semibold tracking-[-0.02em]">{value}</span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
  );
}

/** A titled card for one breakdown. */
export function StorageSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn("flex min-w-0 flex-col gap-4 rounded-[18px] bg-card p-5 ring-1 ring-border", className)}
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className="font-display text-lg font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export type ShareRow = {
  key: string;
  label: React.ReactNode;
  bytes: number;
  files: number;
};

/**
 * Rows of label, size and file count, each with a thin bar for its share of
 * `total`. Scrolls sideways inside its own box on narrow screens.
 */
export function ShareTable({ rows, total, empty }: { rows: ShareRow[]; total: number; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[420px] text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="w-[40%] pb-2 font-normal">Tên</th>
            <th className="w-[30%] pb-2 font-normal">Tỉ lệ</th>
            <th className="pb-2 text-right font-normal">Dung lượng</th>
            <th className="pb-2 pl-3 text-right font-normal">File</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = total ? (r.bytes / total) * 100 : 0;
            return (
              <tr key={r.key} className="border-t border-border/60">
                <td className="max-w-0 py-2.5 pr-3">{r.label}</td>
                <td className="py-2.5 pr-3">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: r.bytes ? `max(${pct}%, 2px)` : 0 }}
                      />
                    </span>
                    <span className="w-10 text-right font-mono text-xs text-muted-foreground">
                      {pct < 1 && r.bytes > 0 ? "<1" : Math.round(pct)}%
                    </span>
                  </span>
                </td>
                <td className="py-2.5 text-right font-mono whitespace-nowrap">{formatBytes(r.bytes)}</td>
                <td className="py-2.5 pl-3 text-right font-mono text-muted-foreground">{r.files}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
