"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getTimeZoneOptions } from "@/lib/timezones";

interface TimezoneSelectProps {
  value: string;
  onChange: (timezone: string) => void;
  triggerClassName?: string;
  dropdownClassName?: string;
}

export function TimezoneSelect({
  value,
  onChange,
  triggerClassName = "flex h-9 w-[240px] items-center justify-between rounded-md border border-input bg-background px-2 text-xs hover:bg-muted",
  dropdownClassName = "absolute right-0 top-full z-10 mt-2 w-[360px] overflow-hidden rounded-lg border border-border bg-card shadow-md",
}: TimezoneSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const options = useMemo(() => getTimeZoneOptions(), []);
  const resolvedValue = useMemo(() => (options.includes(value) ? value : "UTC"), [options, value]);

  const filteredTimeZones = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((tz) => tz.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const target = event.target as Node | null;
      if (target && root.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "Backspace") {
        setQuery((prev) => prev.slice(0, -1));
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        setQuery((prev) => `${prev} `);
        return;
      }

      if (event.key.length === 1) {
        setQuery((prev) => `${prev}${event.key}`);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          setQuery("");
          setOpen((v) => !v);
        }}
        className={triggerClassName}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{resolvedValue}</span>
        <span className="text-[10px] text-muted-foreground">▼</span>
      </button>

      {open ? (
        <div className={dropdownClassName}>
          <div className="flex items-center justify-between border-b border-border px-2 py-2 text-[11px] text-muted-foreground">
            <span className="truncate">
              {query ? `Filter: ${query}` : "Type to filter timezones"}
            </span>
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted"
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="max-h-[320px] overflow-auto p-1" role="listbox" aria-label="Timezone options">
            {filteredTimeZones.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">No matches</div>
            ) : (
              filteredTimeZones.map((tz) => (
                <button
                  key={tz}
                  type="button"
                  onClick={() => {
                    onChange(tz);
                    setQuery(tz);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs hover:bg-muted ${
                    tz === resolvedValue ? "bg-muted" : ""
                  }`}
                >
                  <span className="truncate">{tz}</span>
                  {tz === resolvedValue ? <span className="text-[10px] text-muted-foreground">selected</span> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

