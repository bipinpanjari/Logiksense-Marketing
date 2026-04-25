import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  className,
  action,
}: {
  /** Breadcrumb or context line above the title */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {eyebrow ? <div className="text-sm text-muted-foreground">{eyebrow}</div> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-page-title">{title}</h1>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {description ? (
        <div className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</div>
      ) : null}
    </div>
  );
}
