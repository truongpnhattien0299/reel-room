import { ReelMark, Wordmark } from "@/components/brand/reel-mark";
import { ToneTile } from "@/components/folders/media-thumb";

// Decorative "contact sheet": [column span, row span] per tile.
const SHEET: [number, number][] = [
  [2, 2], [1, 1], [1, 2], [1, 1], [1, 2], [2, 1], [1, 1], [2, 1], [1, 1], [1, 1],
];

/** Split layout for login and set-password: collage left, form right. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-wrap bg-background">
      <section
        aria-hidden="true"
        className="hidden min-w-0 flex-[1_1_560px] flex-col gap-7 bg-sidebar p-6 lg:flex"
      >
        <div className="grid min-h-[420px] flex-1 auto-rows-[minmax(90px,1fr)] grid-cols-4 gap-2">
          {SHEET.map(([col, row], i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl"
              style={{ gridColumn: `span ${col}`, gridRow: `span ${row}` }}
            >
              <ToneTile seed={`sheet-${i}`} />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2.5 px-2 pb-2">
          <p className="max-w-[14ch] font-display text-[clamp(32px,3.4vw,48px)] leading-[1.05] font-bold tracking-[-0.03em]">
            Mọi khung hình của team, ở một nơi.
          </p>
          <p className="max-w-[46ch] text-[15px] text-muted-foreground">
            Lưu trữ ảnh và video theo folder, chia sẻ đúng người, xem ngay trên trình duyệt.
          </p>
        </div>
      </section>

      <main className="flex min-w-0 flex-[1_1_420px] items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-[380px] flex-col gap-8">
          <div className="flex items-center gap-2.5">
            <ReelMark className="size-10 rounded-xl" />
            <Wordmark className="text-[22px]" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export function AuthHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="font-display text-[32px] leading-tight font-bold tracking-[-0.02em]">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
