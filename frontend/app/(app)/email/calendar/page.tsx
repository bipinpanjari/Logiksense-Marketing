"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listCampaigns, updateCampaign } from "@/lib/marketing-email";
import { getTimeZoneOptions } from "@/lib/timezones";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { CALENDAR_STATUS_LEGEND } from "@/lib/calendar-status-styles";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/layout/page-shell";

type CampaignEvent = {
  id: string;
  name: string;
  status: string;
  when: Date;
  audience: number;
};

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toDateKey(d: Date) {
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toDateKeyInZone(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value || "0000";
  const m = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  return `${y}-${m}-${day}`;
}

function parseDateInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function clampToDayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function clampToDayEnd(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfMonthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  return new Date(first.getFullYear(), first.getMonth(), first.getDate() - first.getDay());
}

export default function EmailCalendarPage() {
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [timeZone, setTimeZone] = useState("UTC");
  const [draggingCampaignId, setDraggingCampaignId] = useState<string>("");
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rangeFrom, setRangeFrom] = useState<string>("");
  const [rangeTo, setRangeTo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const pickerRootRef = useRef<HTMLDivElement | null>(null);
  const timeZoneOptions = useMemo(() => getTimeZoneOptions(), []);

  const resolvedTimeZone = useMemo(() => {
    if (timeZoneOptions.includes(timeZone)) return timeZone;
    return "UTC";
  }, [timeZone, timeZoneOptions]);


  const visibleRange = useMemo(() => {
    if (viewMode === "day") {
      const base = selectedDate ? parseDateInput(selectedDate) || monthCursor : monthCursor;
      return { start: clampToDayStart(base), end: clampToDayEnd(base) };
    }
    if (viewMode === "week") {
      const d = new Date(monthCursor);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
      return { start, end };
    }
    const start = startOfMonthGrid(monthCursor);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 41, 23, 59, 59, 999);
    return { start, end };
  }, [monthCursor, viewMode, selectedDate]);

  async function loadEvents() {
    setLoading(true);
    setError("");
    try {
      const fromDate = rangeFrom ? parseDateInput(rangeFrom) : visibleRange.start;
      const toDate = rangeTo ? parseDateInput(rangeTo) : visibleRange.end;

      const data = await listCampaigns({
        from: clampToDayStart(fromDate || visibleRange.start).toISOString(),
        to: clampToDayEnd(toDate || visibleRange.end).toISOString(),
      });

      const normalized = (Array.isArray(data) ? data : [])
        .map((item: any) => {
          const rawDate = item.scheduled_at || item.launched_at || item.created_at;
          const date = rawDate ? new Date(rawDate) : null;
          if (!date || Number.isNaN(date.getTime())) return null;
          return {
            id: item.id,
            name: item.name,
            status: item.status || "draft",
            when: date,
            audience: Number(item.audience_count || 0),
          } as CampaignEvent;
        })
        .filter(Boolean) as CampaignEvent[];
      setEvents(normalized);
    } catch (e: any) {
      setError(e?.message || "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthCursor, viewMode, selectedDate, rangeFrom, rangeTo]);

  useEffect(() => {
    if (!pickerOpen) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const root = pickerRootRef.current;
      if (!root) return;
      const target = event.target as Node | null;
      if (target && root.contains(target)) return;
      setPickerOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPickerOpen(false);
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
  }, [pickerOpen]);

  const eventsByDate = useMemo(() => {
    const from = rangeFrom ? parseDateInput(rangeFrom) : null;
    const to = rangeTo ? parseDateInput(rangeTo) : null;
    const fromMs = from ? clampToDayStart(from).getTime() : null;
    const toMs = to ? clampToDayEnd(to).getTime() : null;

    const map = new Map<string, CampaignEvent[]>();
    events.forEach((evt) => {
      const ts = evt.when.getTime();
      if (fromMs !== null && ts < fromMs) return;
      if (toMs !== null && ts > toMs) return;

      const key = toDateKeyInZone(evt.when, resolvedTimeZone);
      const existing = map.get(key) || [];
      existing.push(evt);
      map.set(key, existing);
    });
    return map;
  }, [events, rangeFrom, rangeTo, resolvedTimeZone]);

  const gridDays = useMemo(() => {
    const start = startOfMonthGrid(monthCursor);
    const result: Date[] = [];
    for (let i = 0; i < 42; i++) {
      result.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return result;
  }, [monthCursor]);

  const selectedEvents = selectedDate ? eventsByDate.get(selectedDate) || [] : [];
  const todayKey = toDateKey(new Date());
  const isPanelOpen = Boolean(selectedDate);

  const weekDays = useMemo(() => {
    const d = new Date(monthCursor);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
    return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [monthCursor]);

  async function handleReschedule(campaignId: string, dateKey: string) {
    if (!campaignId) return;
    setUpdating(true);
    setError("");
    try {
      await updateCampaign(campaignId, {
        scheduledAt: new Date(`${dateKey}T09:00:00`).toISOString(),
        status: "scheduled",
      });
      await loadEvents();
    } catch (e: any) {
      setError(e?.message || "Failed to reschedule");
    } finally {
      setUpdating(false);
      setDraggingCampaignId("");
    }
  }

  async function handleQuickAction(campaignId: string, action: "launch" | "pause" | "edit", currentName: string) {
    setUpdating(true);
    setError("");
    try {
      if (action === "launch") {
        await updateCampaign(campaignId, { status: "active" });
      } else if (action === "pause") {
        await updateCampaign(campaignId, { status: "paused" });
      } else {
        const nextName = window.prompt("Edit campaign name", currentName);
        if (!nextName || !nextName.trim()) return;
        await updateCampaign(campaignId, { name: nextName.trim() });
      }
      await loadEvents();
    } catch (e: any) {
      setError(e?.message || "Failed to update campaign");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Campaign calendar"
        description="Month, week, and day views with drag-drop scheduling, quick actions, and timezone support."
      />

      <div className={`grid gap-6 ${isPanelOpen ? "xl:grid-cols-[1fr_340px]" : "grid-cols-1"}`}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="relative" ref={pickerRootRef}>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-left text-base font-semibold tracking-tight hover:bg-muted"
                onClick={() => setPickerOpen((v) => !v)}
              >
                {monthCursor.toLocaleString(undefined, { month: "long", year: "numeric" })}
              </button>

              {pickerOpen ? (
                <div
                  className="absolute left-0 top-full z-10 mt-2 w-[340px] rounded-lg border border-border bg-card p-4 shadow-md"
                  role="dialog"
                  aria-label="Month picker"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-border px-2 py-1 text-sm hover:bg-muted"
                      onClick={() => setMonthCursor((d) => new Date(d.getFullYear() - 1, d.getMonth(), 1))}
                    >
                      -1y
                    </button>
                    <p className="text-sm font-medium">{monthCursor.getFullYear()}</p>
                    <button
                      type="button"
                      className="rounded-md border border-border px-2 py-1 text-sm hover:bg-muted"
                      onClick={() => setMonthCursor((d) => new Date(d.getFullYear() + 1, d.getMonth(), 1))}
                    >
                      +1y
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {MONTHS.map((m, idx) => {
                      const active = idx === monthCursor.getMonth();
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setMonthCursor((d) => new Date(d.getFullYear(), idx, 1));
                            setPickerOpen(false);
                          }}
                          className={`rounded-md border px-2 py-2 text-xs font-medium transition ${
                            active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                          }`}
                        >
                          {m.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick ranges</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                        onClick={() => {
                          setRangeFrom("");
                          setRangeTo("");
                        }}
                      >
                        All time
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                        onClick={() => {
                          const now = new Date();
                          const start = new Date(now.getFullYear(), now.getMonth(), 1);
                          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                          setRangeFrom(toDateKey(start));
                          setRangeTo(toDateKey(end));
                        }}
                      >
                        This month
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                        onClick={() => {
                          const now = new Date();
                          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
                          setRangeFrom(toDateKey(start));
                          setRangeTo(toDateKey(now));
                        }}
                      >
                        Last 7 days
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                        onClick={() => {
                          const now = new Date();
                          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
                          setRangeFrom(toDateKey(start));
                          setRangeTo(toDateKey(now));
                        }}
                      >
                        Last 30 days
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custom range</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={rangeFrom}
                        onChange={(e) => setRangeFrom(e.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                      />
                      <input
                        type="date"
                        value={rangeTo}
                        onChange={(e) => setRangeTo(e.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:underline"
                      onClick={() => {
                        const now = new Date();
                        setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
                        setPickerOpen(false);
                      }}
                    >
                      Jump to today
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                      onClick={() => setPickerOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <div className="mr-2">
                <TimezoneSelect value={resolvedTimeZone} onChange={setTimeZone} />
              </div>
              <div className="mr-2 flex items-center gap-1 rounded-md border border-border p-1">
                {(["month", "week", "day"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`rounded px-2 py-1 text-xs font-medium ${viewMode === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    onClick={() => setViewMode(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? <p className="text-sm text-muted-foreground">Loading campaigns...</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {updating ? <p className="text-sm text-muted-foreground">Applying updates...</p> : null}

            <div className="flex flex-wrap items-center gap-2 pb-2">
              <span className="text-xs font-semibold text-muted-foreground">Status legend:</span>
              {CALENDAR_STATUS_LEGEND.map((s) => (
                <span key={s.key} className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${s.className}`}>
                  {s.key}
                </span>
              ))}
            </div>

            {viewMode !== "day" ? (
              <div className="grid grid-cols-7 gap-2 text-xs font-medium text-muted-foreground">
                {WEEK_DAYS.map((w) => (
                  <div key={w} className="px-2 py-1">
                    {w}
                  </div>
                ))}
              </div>
            ) : null}

            {viewMode === "month" ? (
              <div className="grid grid-cols-7 gap-2">
                {gridDays.map((day) => {
                  const domKey = toDateKey(day);
                  const zoneKey = toDateKeyInZone(day, timeZone);
                  const dayEvents = eventsByDate.get(zoneKey) || [];
                  const inMonth = day.getMonth() === monthCursor.getMonth();
                  const isToday = domKey === todayKey;
                  return (
                    <button
                      key={domKey}
                      onClick={() => setSelectedDate((prev) => (prev === zoneKey ? "" : zoneKey))}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData("text/plain") || draggingCampaignId;
                        handleReschedule(id, zoneKey);
                      }}
                      className={`min-h-[110px] rounded-md border p-2 text-left transition ${
                        inMonth ? "bg-background" : "bg-muted/40"
                      } ${isToday ? "border-primary" : "border-border"} ${
                        selectedDate === zoneKey ? "ring-2 ring-primary/40" : ""
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className={`text-xs ${inMonth ? "text-foreground" : "text-muted-foreground"}`}>{day.getDate()}</span>
                        {dayEvents.length > 0 ? (
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                            {dayEvents.length}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 2).map((evt) => (
                          <div
                            key={evt.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", evt.id);
                              setDraggingCampaignId(evt.id);
                            }}
                            className="truncate rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                          >
                            {evt.name}
                          </div>
                        ))}
                        {dayEvents.length > 2 ? (
                          <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 2} more</div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {viewMode === "week" ? (
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day) => {
                  const zoneKey = toDateKeyInZone(day, timeZone);
                  const dayEvents = eventsByDate.get(zoneKey) || [];
                  return (
                    <div
                      key={zoneKey}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData("text/plain") || draggingCampaignId;
                        handleReschedule(id, zoneKey);
                      }}
                      className={`min-h-[180px] rounded-md border p-2 ${selectedDate === zoneKey ? "ring-2 ring-primary/40" : ""}`}
                    >
                      <button
                        type="button"
                        className="mb-2 text-xs font-medium hover:underline"
                        onClick={() => setSelectedDate((prev) => (prev === zoneKey ? "" : zoneKey))}
                      >
                        {day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
                      </button>
                      <div className="space-y-1">
                        {dayEvents.map((evt) => (
                          <div
                            key={evt.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", evt.id);
                              setDraggingCampaignId(evt.id);
                            }}
                            className="truncate rounded bg-primary/10 px-1.5 py-1 text-[11px] text-primary"
                          >
                            {evt.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {viewMode === "day" ? (
              <div className="space-y-2 rounded-md border p-3">
                {(() => {
                  const key = selectedDate || toDateKeyInZone(monthCursor, timeZone);
                  const dayEvents = eventsByDate.get(key) || [];
                  return dayEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No events for this day.</p>
                  ) : (
                    dayEvents.map((evt) => (
                      <div key={evt.id} className="rounded-md border border-border p-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{evt.name}</p>
                          <Badge variant={evt.status === "active" ? "success" : "secondary"}>{evt.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {evt.when.toLocaleTimeString(undefined, { timeZone: resolvedTimeZone })}
                        </p>
                      </div>
                    ))
                  );
                })()}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {isPanelOpen ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {`Events on ${new Date(selectedDate).toLocaleDateString(undefined, { timeZone: resolvedTimeZone })}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No campaigns on this date.</p>
              ) : (
                selectedEvents.map((evt) => (
                  <div key={evt.id} className="rounded-md border border-border p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{evt.name}</p>
                      <Badge variant={evt.status === "active" ? "success" : "secondary"}>{evt.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{evt.when.toLocaleTimeString(undefined, { timeZone: resolvedTimeZone })}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Audience: {evt.audience.toLocaleString()}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                        onClick={() => handleQuickAction(evt.id, "launch", evt.name)}
                      >
                        Launch
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                        onClick={() => handleQuickAction(evt.id, "pause", evt.name)}
                      >
                        Pause
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                        onClick={() => handleQuickAction(evt.id, "edit", evt.name)}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </PageShell>
  );
}

