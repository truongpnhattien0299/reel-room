"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/server/actions";

/** Single text-field dialog used for "new folder" and every rename. */
export function NameDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  defaultValue = "",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  defaultValue?: string;
  onSubmit: (name: string) => Promise<ActionResult>;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(undefined);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get("name"));
            startTransition(async () => {
              const res = await onSubmit(name);
              if (res.error) setError(res.error);
              else onOpenChange(false);
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <Field data-invalid={error ? true : undefined}>
            <Input
              name="name"
              defaultValue={defaultValue}
              aria-label="Tên"
              autoFocus
              onFocus={(e) => {
                // Select the base name so typing replaces it but keeps the extension.
                const dot = e.currentTarget.value.lastIndexOf(".");
                e.currentTarget.setSelectionRange(0, dot > 0 ? dot : e.currentTarget.value.length);
              }}
              required
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
