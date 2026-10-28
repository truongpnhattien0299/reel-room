"use client";

import { ImageUpIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { removeMyAvatar, setMyAvatar, signAvatarUpload } from "@/server/actions";

const SIZE = 256;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/** Center square crop, scaled to SIZE, as WebP. */
async function toAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    SIZE,
    SIZE,
  );
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob || blob.type !== "image/webp") throw new Error("encode");
  return blob;
}

export function AvatarEditor({
  user,
}: {
  user: { id: string; name: string; image: string | null };
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    if (file.size > MAX_INPUT_BYTES) {
      toast.error("Ảnh quá lớn (tối đa 25 MB)");
      return;
    }
    startTransition(async () => {
      let blob: Blob;
      try {
        blob = await toAvatar(file);
      } catch {
        toast.error("Không đọc được ảnh này, hãy thử JPG hoặc PNG");
        return;
      }
      const signed = await signAvatarUpload();
      if (signed.error || !signed.data) {
        toast.error(signed.error ?? "Không tải ảnh lên được");
        return;
      }
      const put = await fetch(signed.data.url, {
        method: "PUT",
        headers: signed.data.headers,
        body: blob,
      }).catch(() => null);
      if (!put?.ok) {
        toast.error("Không tải ảnh lên được");
        return;
      }
      const res = await setMyAvatar(signed.data.key);
      if (res.error) toast.error(res.error);
      else toast.success("Đã cập nhật ảnh đại diện");
    });
  }

  return (
    <section
      aria-labelledby="avatar-heading"
      className="flex flex-col gap-5 rounded-[18px] bg-card p-5 ring-1 ring-border"
    >
      <h2 id="avatar-heading" className="font-display text-lg font-semibold">
        Ảnh đại diện
      </h2>
      <div className="flex flex-wrap items-center gap-5">
        <div className="relative">
          <UserAvatar user={user} className="size-24 text-2xl" />
          {pending && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
              <Loader2Icon className="size-6 animate-spin" aria-label="Đang xử lý" />
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>
              <ImageUpIcon data-icon="inline-start" />
              {user.image ? "Đổi ảnh" : "Tải ảnh lên"}
            </Button>
            {user.image && (
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await removeMyAvatar();
                    if (res.error) toast.error(res.error);
                    else toast.success("Đã xoá ảnh đại diện");
                  })
                }
              >
                <Trash2Icon data-icon="inline-start" />
                Xoá ảnh
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Ảnh được cắt vuông ở giữa. JPG, PNG hoặc WebP.
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) upload(file);
        }}
      />
    </section>
  );
}
