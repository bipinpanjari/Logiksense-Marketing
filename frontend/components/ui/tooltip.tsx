"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Hover tooltip with no open delay (native `title` waits ~1s in most browsers). */
export function InstantTooltip({
  label,
  children,
  className,
  side = "top",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  side?: "top" | "bottom";
}) {
  return (
    <span className={cn("group/instip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-[100] w-max max-w-[min(280px,calc(100vw-16px))] rounded-md border border-border bg-popover px-2 py-1.5 text-left text-xs leading-snug text-popover-foreground shadow-md",
          "invisible opacity-0 transition-none group-hover/instip:visible group-hover/instip:opacity-100 group-focus-within/instip:visible group-focus-within/instip:opacity-100",
          side === "top"
            ? "bottom-full left-1/2 mb-1 -translate-x-1/2"
            : "top-full left-1/2 mt-1 -translate-x-1/2",
        )}
      >
        {label}
      </span>
    </span>
  );
}
