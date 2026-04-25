import * as React from "react";
import { cn } from "@/lib/utils";

/** Standard vertical rhythm for full-width app pages. Use `narrow` for settings-style forms. */
export function PageShell({
  children,
  className,
  narrow,
}: {
  children: React.ReactNode;
  className?: string;
  /** Center and cap width (e.g. settings, profile). */
  narrow?: boolean;
}) {
  return (
    <div
      className={cn(
        "space-y-8",
        narrow && "mx-auto w-full max-w-[min(100%,90rem)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
