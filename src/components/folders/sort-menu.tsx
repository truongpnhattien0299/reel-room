"use client";

import { ArrowUpDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type SortOption<T extends string> = {
  value: T;
  label: string;
  /** Shown on the button; defaults to `label`. */
  short?: string;
};

/** "Sắp xếp" dropdown: a button showing the current order, radio items to change it. */
export function SortMenu<T extends string>({
  value,
  options,
  onChange,
  size = "lg",
}: {
  value: T;
  options: SortOption<T>[];
  onChange: (value: T) => void;
  size?: "default" | "lg";
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size={size} aria-label={`Sắp xếp: ${current.label}`} />}
      >
        <ArrowUpDownIcon data-icon="inline-start" />
        {current.short ?? current.label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sắp xếp theo</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as T)}>
            {options.map((o) => (
              <DropdownMenuRadioItem key={o.value} value={o.value}>
                {o.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
