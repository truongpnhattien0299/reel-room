"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resendInvite } from "@/server/actions";

export function ResendInviteButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await resendInvite(userId);
          if (res.error) toast.error(res.error);
          else toast.success("Đã gửi lại lời mời");
        })
      }
    >
      Gửi lại lời mời
    </Button>
  );
}
