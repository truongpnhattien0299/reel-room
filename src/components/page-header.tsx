import { SidebarTrigger } from "@/components/ui/sidebar";

/** Centered content column shared by every page inside the app shell. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 px-5 pt-5 pb-28 sm:px-8 lg:px-12 lg:pt-8">
      {children}
    </div>
  );
}

export function PageHeader({
  breadcrumb,
  title,
  description,
  actions,
}: {
  breadcrumb?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex min-h-8 items-center gap-2 md:min-h-0">
        <SidebarTrigger className="-ml-1.5 size-9 md:hidden" />
        {breadcrumb}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="font-display text-[34px] leading-[1.05] font-bold tracking-[-0.03em] break-words sm:text-[44px]">
            {title}
          </h1>
          {description && <div className="text-[15px] text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionHeading({
  id,
  children,
  action,
}: {
  id?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="font-display text-xl font-semibold tracking-[-0.01em]">
        {children}
      </h2>
      {action}
    </div>
  );
}
