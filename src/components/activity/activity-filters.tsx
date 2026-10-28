"use client";

import { format, isSameDay, parse, startOfMonth, subDays, subMonths } from "date-fns";
import { vi as viDates } from "date-fns/locale";
import { CalendarIcon, CogIcon, LayersIcon, UsersIcon, XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { vi } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

const ALL = "all";

const GROUPS = [
  { value: ALL, label: "Mọi loại" },
  { value: "file", label: "File" },
  { value: "folder", label: "Folder" },
  { value: "share", label: "Quyền thành viên" },
  { value: "link", label: "Link chia sẻ" },
  { value: "user", label: "Tài khoản" },
];

/** URL dates are plain `yyyy-MM-dd` days (the server reads them as Vietnam time). */
const DAY = "yyyy-MM-dd";
const toDay = (d: Date) => format(d, DAY);
const fromDay = (s: string | null) => (s ? parse(s, DAY, new Date()) : undefined);

const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: "Hôm nay", range: () => ({ from: new Date(), to: new Date() }) },
  { label: "7 ngày qua", range: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "30 ngày qua", range: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "Tháng này", range: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
];

/** Filters that hold a value get a tinted outline, so the active ones stand out. */
const activeField = "border-primary/50 bg-primary/10 text-foreground dark:bg-primary/10 dark:hover:bg-primary/15";

function rangeLabel(range: DateRange | undefined) {
  if (!range?.from) return "Mọi lúc";
  const short = (d: Date) => format(d, "d MMM", { locale: viDates });
  const full = (d: Date) => format(d, "d MMM yyyy", { locale: viDates });
  if (!range.to || isSameDay(range.from, range.to)) return full(range.from);
  const sameYear = range.from.getFullYear() === range.to.getFullYear();
  return `${sameYear ? short(range.from) : full(range.from)} – ${full(range.to)}`;
}

type Actor = { value: string; label: string; user?: { id: string; name: string; image: string | null } };

/** Avatar for a user, a cog for the system, a group icon for "everyone". */
function ActorBadge({ actor }: { actor: Actor | undefined }) {
  if (actor?.user) return <UserAvatar user={actor.user} className="size-5 text-[9px]" />;
  const Icon = actor?.value === "system" ? CogIcon : UsersIcon;
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Icon className="size-3" />
    </span>
  );
}

/** Who / what / when filters for the admin log, kept in the URL. */
export function ActivityFilters({ users }: { users: { id: string; name: string; image: string | null }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [dateOpen, setDateOpen] = useState(false);

  const actor = params.get("actor") ?? ALL;
  const group = params.get("group") ?? ALL;
  const range: DateRange | undefined = params.get("from")
    ? { from: fromDay(params.get("from")), to: fromDay(params.get("to")) }
    : undefined;
  const active = ["actor", "group", "from", "to"].some((k) => params.get(k));

  const actors: Actor[] = [
    { value: ALL, label: "Mọi người" },
    { value: "system", label: "Hệ thống" },
    ...users.map((u) => ({ value: u.id, label: u.name, user: u })),
  ];

  function set(values: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value && value !== ALL) next.set(key, value);
      else next.delete(key);
    }
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }

  function setRange(r: DateRange | undefined) {
    set({ from: r?.from && toDay(r.from), to: r?.to && toDay(r.to) });
  }

  return (
    <div role="group" aria-label="Lọc nhật ký" className="flex flex-wrap items-center gap-2">
      <Select items={actors} value={actor} onValueChange={(v) => set({ actor: v ?? undefined })}>
        <SelectTrigger
          aria-label="Người làm"
          className={cn("h-9 min-w-44 rounded-[10px] px-3", actor !== ALL && activeField)}
        >
          <SelectValue>
            {(value: string) => {
              const a = actors.find((x) => x.value === value);
              return (
                <>
                  <ActorBadge actor={a} />
                  {a?.label}
                </>
              );
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start">
          {actors.map((a) => (
            <SelectItem key={a.value} value={a.value}>
              <ActorBadge actor={a} />
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select items={GROUPS} value={group} onValueChange={(v) => set({ group: v ?? undefined })}>
        <SelectTrigger
          aria-label="Loại"
          className={cn("h-9 min-w-44 rounded-[10px] px-3", group !== ALL && activeField)}
        >
          <LayersIcon className="text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start">
          {GROUPS.map((g) => (
            <SelectItem key={g.value} value={g.value}>
              {g.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              aria-label="Khoảng thời gian"
              className={cn(
                "h-9 min-w-44 justify-start rounded-[10px] px-3 font-normal",
                range && activeField,
              )}
            />
          }
        >
          <CalendarIcon className="text-muted-foreground" />
          {rangeLabel(range)}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <div className="flex flex-col sm:flex-row">
            <div className="flex gap-1 overflow-x-auto border-b border-border p-2 sm:w-36 sm:flex-col sm:border-r sm:border-b-0">
              {PRESETS.map((p) => (
                <Button
                  key={p.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    setRange(p.range());
                    setDateOpen(false);
                  }}
                >
                  {p.label}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-muted-foreground"
                disabled={!range}
                onClick={() => {
                  setRange(undefined);
                  setDateOpen(false);
                }}
              >
                Mọi lúc
              </Button>
            </div>
            <Calendar
              mode="range"
              locale={vi}
              selected={range}
              onSelect={setRange}
              // Two months ending at the picked range (or today); nothing to pick past today.
              defaultMonth={subMonths(range?.to ?? range?.from ?? new Date(), 1)}
              endMonth={new Date()}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
              className="p-3 [--cell-size:--spacing(8)]"
            />
          </div>
        </PopoverContent>
      </Popover>

      {active && (
        <Button
          variant="ghost"
          className="h-9 text-muted-foreground"
          onClick={() => router.replace(pathname, { scroll: false })}
        >
          <XIcon data-icon="inline-start" />
          Bỏ lọc
        </Button>
      )}
    </div>
  );
}
