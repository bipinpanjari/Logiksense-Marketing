"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ContactNote,
  PipelineBoard,
  PipelineLead,
  PipelineStage,
  STAGE_LABELS,
  TimelineEvent,
  createLeadNote,
  deleteLeadNote,
  getLeadTimeline,
  getPipelineBoard,
  setLeadStage,
} from "@/lib/pipeline";
import { BusinessIntelBody } from "@/components/research/business-intel-body";
import { researchModelFromPipelineLead } from "@/lib/business-research-model";
import { PIPELINE_STAGE_CHIP_CLASS } from "@/lib/pipeline-stage-styles";
import { Callout } from "@/components/ui/callout";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/layout/page-shell";

function timelineEventTitle(ev: TimelineEvent): string {
  switch (ev.type) {
    case "stage_change":
      return "Stage change";
    case "queued":
      return "Queued";
    case "sent":
      return "Sent";
    case "opened":
      return "Opened";
    case "clicked":
      return "Clicked";
    case "replied":
      return "Replied";
    case "bounced":
      return "Bounced";
    case "unsubscribed":
      return "Unsubscribed";
    case "note":
      return "Note";
    default:
      return ev.type;
  }
}

function timelineEventSummary(ev: TimelineEvent): string | null {
  const d = ev.data;
  if (!d || Object.keys(d).length === 0) return null;
  if (ev.type === "stage_change") {
    const from = d.from;
    const to = d.to;
    const source = d.source;
    if (typeof from === "string" && typeof to === "string") {
      return `${from} → ${to}${source != null ? ` (${String(source)})` : ""}`;
    }
  }
  return null;
}

export default function PipelinePage() {
  const [board, setBoard] = useState<PipelineBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PipelineLead | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const leadResearch = useMemo(
    () => (selected ? researchModelFromPipelineLead(selected) : null),
    [selected],
  );

  async function load() {
    setLoading(true);
    try {
      const data = await getPipelineBoard();
      setBoard(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selected) return;
    const root = document.documentElement;
    const body = document.body;
    const prevRootOverflow = root.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevRootOverscroll = root.style.overscrollBehavior;
    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    return () => {
      root.style.overflow = prevRootOverflow;
      body.style.overflow = prevBodyOverflow;
      root.style.overscrollBehavior = prevRootOverscroll;
    };
  }, [selected]);

  async function openLead(lead: PipelineLead) {
    setSelected(lead);
    setTimelineEvents([]);
    setNotes([]);
    try {
      const t = await getLeadTimeline(lead.id);
      setTimelineEvents(t.events || []);
      setNotes(t.notes || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load timeline");
    }
  }

  async function onAddNote() {
    if (!selected || !noteDraft.trim()) return;
    setBusy(true);
    try {
      const note = await createLeadNote(selected.id, noteDraft.trim());
      setNotes((prev) => [note as ContactNote, ...prev]);
      setNoteDraft("");
    } catch (e: any) {
      setError(e?.message || "Failed to save note");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteNote(id: string) {
    setBusy(true);
    try {
      await deleteLeadNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (e: any) {
      setError(e?.message || "Failed to delete note");
    } finally {
      setBusy(false);
    }
  }

  async function onMoveStage(stage: PipelineStage) {
    if (!selected) return;
    setBusy(true);
    try {
      await setLeadStage(selected.id, stage);
      await load();
      const refreshed = await getLeadTimeline(selected.id);
      setTimelineEvents(refreshed.events || []);
      setSelected({ ...selected, pipeline_stage: stage });
    } catch (e: any) {
      setError(e?.message || "Failed to move stage");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Pipeline"
        description="Leads grouped by engagement stage. Stages update automatically from sends, opens, clicks, replies, and bounces."
      />

      {error ? <Callout variant="destructive">{error}</Callout> : null}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading board…</div>
      ) : !board ? (
        <div className="text-sm text-destructive">Failed to load pipeline.</div>
      ) : (
        <div className="flex snap-x gap-3 overflow-x-auto pb-2">
          {board.columns.map((col) => (
            <div key={col.stage} className="min-w-[260px] w-[260px] flex-shrink-0 snap-start">
              <div className={`rounded-md border p-3 ${PIPELINE_STAGE_CHIP_CLASS[col.stage]}`}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{STAGE_LABELS[col.stage]}</div>
                  <Badge variant="outline">{col.count}</Badge>
                </div>
              </div>
              <div className="mt-2 space-y-2">
                {col.leads.length === 0 ? (
                  <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    No leads in this stage.
                  </div>
                ) : (
                  col.leads.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => openLead(lead)}
                      className="w-full rounded-md border bg-card p-3 text-left text-sm shadow-sm transition hover:border-primary/50"
                    >
                      <div className="font-medium truncate">
                        {lead.first_name || lead.last_name
                          ? `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim()
                          : lead.email}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{lead.email}</div>
                      {lead.company && (
                        <div className="mt-1 truncate text-xs text-muted-foreground">{lead.company}</div>
                      )}
                      {lead.pipeline_stage_updated_at && (
                        <div className="mt-2 text-[10px] text-muted-foreground">
                          {new Date(lead.pipeline_stage_updated_at).toLocaleString()}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex justify-end bg-foreground/35 backdrop-blur-[2px] overscroll-none"
              onClick={() => setSelected(null)}
            >
              <div
                className="flex h-full w-full max-w-full shrink-0 flex-col border-l border-border/80 bg-card shadow-lg sm:max-w-[min(40rem,calc(100%-0.75rem))] md:max-w-[min(44rem,calc(100%-1rem))] lg:max-w-[min(48rem,calc(100%-1.25rem))]"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="pipeline-lead-title"
              >
            <div className="flex-shrink-0 border-b border-border/70 bg-background px-4 py-3 sm:px-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div id="pipeline-lead-title" className="text-base font-semibold leading-snug tracking-tight sm:text-lg">
                    {selected.first_name || selected.last_name
                      ? `${selected.first_name ?? ""} ${selected.last_name ?? ""}`.trim()
                      : selected.email}
                  </div>
                  <div className="mt-0.5 break-all text-xs text-muted-foreground sm:text-sm">{selected.email}</div>
                  {selected.job_title ? (
                    <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{selected.job_title}</div>
                  ) : null}
                  {selected.company ? (
                    <div className="mt-1 text-xs font-medium text-foreground/90 sm:text-sm">{selected.company}</div>
                  ) : null}
                </div>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Move to</p>
                <div className="overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
                  <div className="flex w-max flex-nowrap gap-2 sm:w-full sm:min-w-0 sm:flex-wrap">
                    {(Object.keys(STAGE_LABELS) as PipelineStage[]).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={s === selected.pipeline_stage ? "default" : "outline"}
                        className="h-8 shrink-0"
                        disabled={busy || s === selected.pipeline_stage}
                        onClick={() => onMoveStage(s)}
                      >
                        {STAGE_LABELS[s]}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
              <Card className="border-border/80 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Maps &amp; website research</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Pulled from the latest scraper result linked to this lead (promoted from a crawl), plus lead enrichment.
                  </p>
                </CardHeader>
                <CardContent>
                  {leadResearch ? (
                    <BusinessIntelBody model={leadResearch} profileCollectedAt={leadResearch.profile?.collectedAt} />
                  ) : null}
                </CardContent>
              </Card>

              <Card className="mt-6 border-border/80 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      placeholder="Add a note…"
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      className="flex-1"
                    />
                    <Button className="shrink-0 sm:w-auto" disabled={busy || !noteDraft.trim()} onClick={onAddNote}>
                      Save
                    </Button>
                  </div>
                  {notes.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No notes yet.</div>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="rounded-md border border-border/70 bg-muted/10 p-3 text-sm">
                        <div className="whitespace-pre-wrap">{note.body}</div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="min-w-0 truncate">
                            {note.author_first_name || note.author_last_name
                              ? `${note.author_first_name ?? ""} ${note.author_last_name ?? ""}`.trim()
                              : "—"}
                            {" · "}
                            {new Date(note.created_at).toLocaleString()}
                          </span>
                          <button type="button" className="shrink-0 text-destructive hover:underline" onClick={() => onDeleteNote(note.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="mt-6 border-border/80 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Activity</CardTitle>
                  <p className="text-xs text-muted-foreground">Email and pipeline events for this contact.</p>
                </CardHeader>
                <CardContent>
                  {timelineEvents.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No events yet.</div>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {timelineEvents
                        .slice()
                        .reverse()
                        .slice(0, 80)
                        .map((ev, idx) => {
                          const summary = timelineEventSummary(ev);
                          const hasRaw =
                            ev.data &&
                            Object.keys(ev.data).length > 0 &&
                            !summary;
                          return (
                            <li key={`${ev.at}-${idx}`} className="rounded-md border border-border/70 bg-muted/5 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <Badge variant="outline" className="font-normal">
                                  {timelineEventTitle(ev)}
                                </Badge>
                                <time className="text-xs text-muted-foreground" dateTime={ev.at}>
                                  {ev.at ? new Date(ev.at).toLocaleString() : ""}
                                </time>
                              </div>
                              {summary ? (
                                <p className="mt-2 text-sm text-foreground/90">{summary}</p>
                              ) : null}
                              {hasRaw ? (
                                <pre className="mt-2 max-h-36 overflow-auto rounded-md bg-muted/40 p-2 text-[11px] leading-relaxed">
                                  {JSON.stringify(ev.data, null, 2)}
                                </pre>
                              ) : null}
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </PageShell>
  );
}
