"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SequenceBasicsCard({
  name,
  description,
  status,
  onName,
  onDescription,
  onStatus,
  statusOptions,
  defaultOpen = true,
}: {
  name: string;
  description: string;
  status: string;
  onName: (v: string) => void;
  onDescription: (v: string) => void;
  onStatus: (v: string) => void;
  statusOptions?: { value: string; label: string }[];
  /** When false, the fields start collapsed. */
  defaultOpen?: boolean;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);

  const opts = statusOptions ?? [
    { value: "draft", label: "Draft" },
    { value: "active", label: "Active" },
    { value: "paused", label: "Paused" },
    { value: "archived", label: "Archived" },
  ];
  const statusLabel = opts.find((o) => o.value === status)?.label ?? status;

  return (
    <div className="rounded-2xl border border-border/80 bg-card shadow-sm ring-1 ring-border/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 rounded-2xl p-6 pb-5 text-left outline-none transition-colors hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        aria-expanded={open}
        aria-controls={panelId}
        id={`${panelId}-trigger`}
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Sequence</h2>
          <p className="mt-1 text-xs text-muted-foreground">Name and status shown in your workspace; description is internal.</p>
          {!open ? (
            <p className="mt-3 truncate text-xs text-muted-foreground">
              <span className="font-medium text-foreground/85">{statusLabel}</span>
              {name.trim() ? <span className="text-muted-foreground"> · {name.trim()}</span> : null}
              {!name.trim() && !description.trim() ? <span className="italic"> · Add details</span> : null}
            </p>
          ) : null}
        </div>
        <ChevronDown
          className={cn("mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
          aria-hidden
        />
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={`${panelId}-trigger`}
        className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
      >
        <div className="overflow-hidden">
          <div className="grid gap-5 px-6 pb-6 pt-0 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="seq-name">
                Name
              </label>
              <Input id="seq-name" value={name} onChange={(e) => onName(e.target.value)} placeholder="e.g. Product trial — nurture" className="h-10" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="seq-status">
                Status
              </label>
              <select
                id="seq-status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={status}
                onChange={(e) => onStatus(e.target.value)}
              >
                {opts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2 lg:col-span-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="seq-desc">
                Description
              </label>
              <Input
                id="seq-desc"
                value={description}
                onChange={(e) => onDescription(e.target.value)}
                placeholder="Optional internal notes"
                className="h-10"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
