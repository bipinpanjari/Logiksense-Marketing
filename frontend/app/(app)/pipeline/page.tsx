"use client";

import { useEffect, useState } from "react";
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
  createLeadNote,
  deleteLeadNote,
  getLeadTimeline,
  getPipelineBoard,
  setLeadStage,
} from "@/lib/pipeline";

const STAGE_COLOURS: Record<PipelineStage, string> = {
  new: "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-900/30 dark:text-zinc-200 dark:border-zinc-800",
  queued: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-200 dark:border-slate-800",
  sent: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800",
  opened: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800",
  clicked: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-200 dark:border-teal-800",
  replied: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-200 dark:border-violet-800",
  bounced: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-800",
  unsubscribed: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800",
};

export default function PipelinePage() {
  const [board, setBoard] = useState<PipelineBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PipelineLead | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Leads grouped by engagement stage. Pipeline stages update automatically from campaign sends,
          opens, clicks, replies and bounces.
        </p>
      </div>

      {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading board…</div>
      ) : !board ? (
        <div className="text-sm text-destructive">Failed to load pipeline.</div>
      ) : (
        <div className="flex snap-x gap-3 overflow-x-auto pb-2">
          {board.columns.map((col) => (
            <div key={col.stage} className="min-w-[260px] w-[260px] flex-shrink-0 snap-start">
              <div className={`rounded-md border p-3 ${STAGE_COLOURS[col.stage]}`}>
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

      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={() => setSelected(null)}>
          <div
            className="h-full w-full max-w-xl overflow-y-auto border-l bg-background p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">
                  {selected.first_name || selected.last_name
                    ? `${selected.first_name ?? ""} ${selected.last_name ?? ""}`.trim()
                    : selected.email}
                </div>
                <div className="text-sm text-muted-foreground">{selected.email}</div>
                {selected.company && (
                  <div className="text-sm text-muted-foreground">{selected.company}</div>
                )}
              </div>
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-xs uppercase text-muted-foreground">Move to:</span>
              {(Object.keys(STAGE_LABELS) as PipelineStage[]).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === selected.pipeline_stage ? "default" : "outline"}
                  disabled={busy || s === selected.pipeline_stage}
                  onClick={() => onMoveStage(s)}
                >
                  {STAGE_LABELS[s]}
                </Button>
              ))}
            </div>

            <Card className="mt-6">
              <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a note…"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                  />
                  <Button disabled={busy || !noteDraft.trim()} onClick={onAddNote}>
                    Save
                  </Button>
                </div>
                {notes.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No notes yet.</div>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="rounded-md border p-3 text-sm">
                      <div className="whitespace-pre-wrap">{note.body}</div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {note.author_first_name || note.author_last_name
                            ? `${note.author_first_name ?? ""} ${note.author_last_name ?? ""}`.trim()
                            : "—"}
                          {" · "}
                          {new Date(note.created_at).toLocaleString()}
                        </span>
                        <button className="text-destructive" onClick={() => onDeleteNote(note.id)}>
                          delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
              <CardContent>
                {timelineEvents.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No events yet.</div>
                ) : (
                  <div className="space-y-2 text-sm">
                    {timelineEvents
                      .slice()
                      .reverse()
                      .slice(0, 80)
                      .map((ev, idx) => (
                        <div key={idx} className="rounded-md border p-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline">{ev.type}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {ev.at ? new Date(ev.at).toLocaleString() : ""}
                            </span>
                          </div>
                          {ev.data && Object.keys(ev.data).length > 0 && (
                            <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted/50 p-2 text-[11px] leading-tight">
                              {JSON.stringify(ev.data, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
