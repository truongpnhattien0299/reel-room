"use client";

import { useState } from "react";
import { formatBytes } from "@/lib/format";
import type { MonthlyGrowth } from "@/server/storage";

const monthLabel = (month: string) => `T${Number(month.slice(5))}`;
const monthLong = (month: string) => `Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`;

/** Bytes uploaded per month as columns; hover or focus a column for its numbers. */
export function StorageGrowthChart({ data }: { data: MonthlyGrowth }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.bytes), 1);
  const total = data.reduce((sum, d) => sum + d.bytes, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        {/* Top grid line carries the scale; the baseline sits under the columns. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="font-mono">{formatBytes(max)}</span>
          <span className="h-px flex-1 bg-border/60" />
        </div>
        <div
          role="list"
          aria-label="Dung lượng upload theo tháng"
          className="flex h-48 items-end gap-[2px] border-b border-border pt-6 sm:gap-1.5"
          onMouseLeave={() => setActive(null)}
        >
          {data.map((d, i) => (
            <div
              key={d.month}
              role="listitem"
              tabIndex={0}
              aria-label={`${monthLong(d.month)}: ${formatBytes(d.bytes)}, ${d.files} file`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="group relative flex h-full flex-1 items-end justify-center rounded-t-[4px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div
                className="w-full max-w-9 rounded-t-[4px] bg-primary transition-opacity data-dim:opacity-45"
                data-dim={active !== null && active !== i ? "" : undefined}
                style={{ height: d.bytes ? `max(${(d.bytes / max) * 100}%, 3px)` : 0 }}
              />
              {active === i && (
                <div
                  className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-lg bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg ring-1 ring-border"
                  style={
                    // Keep the tooltip inside the chart at both ends.
                    i < 2 ? { left: 0 } : i > data.length - 3 ? { right: 0 } : { left: "50%", translate: "-50% 0" }
                  }
                >
                  <div className="text-muted-foreground">{monthLong(d.month)}</div>
                  <div className="font-mono font-medium">
                    {formatBytes(d.bytes)} · {d.files} file
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-[2px] sm:gap-1.5" aria-hidden="true">
          {data.map((d, i) => (
            <span
              key={d.month}
              className="flex-1 text-center font-mono text-[10px] text-muted-foreground sm:text-[11px]"
            >
              {/* Every other label on phones so they don't collide, always keeping the latest. */}
              <span className={(data.length - 1 - i) % 2 ? "max-sm:invisible" : undefined}>
                {monthLabel(d.month)}
              </span>
            </span>
          ))}
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Xem dạng bảng</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 font-normal">Tháng</th>
                <th className="py-1 text-right font-normal">Dung lượng</th>
                <th className="py-1 text-right font-normal">File</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.month} className="border-t border-border/60">
                  <td className="py-1">{monthLong(d.month)}</td>
                  <td className="py-1 text-right">{formatBytes(d.bytes)}</td>
                  <td className="py-1 text-right">{d.files}</td>
                </tr>
              ))}
              <tr className="border-t border-border font-medium">
                <td className="py-1">Tổng</td>
                <td className="py-1 text-right">{formatBytes(total)}</td>
                <td className="py-1 text-right">{data.reduce((sum, d) => sum + d.files, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
