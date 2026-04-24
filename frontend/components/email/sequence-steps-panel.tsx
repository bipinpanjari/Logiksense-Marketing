"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Clock, Mail, Plus, Trash2 } from "lucide-react";

export interface SequenceStep {
  id: number | string;
  name: string;
  delayHours: number;
  subject?: string;
}

function formatWaitLabel(hours: number, stepIndex: number) {
  if (stepIndex === 0) {
    return hours <= 0 ? "Send when enrolled" : `Wait ${hours}h after enroll`;
  }
  return hours === 1 ? "1h after previous" : `${hours}h after previous`;
}

export function SequenceStepsPanel({
  steps,
  selectedStepId,
  onSelectStep,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
  onMoveStep,
}: {
  steps: SequenceStep[];
  selectedStepId: number | string | null;
  onSelectStep: (id: number | string) => void;
  onAddStep: () => void;
  onUpdateStep: (id: number | string, field: keyof SequenceStep, value: string | number) => void;
  onRemoveStep: (id: number | string) => void;
  onMoveStep: (id: number | string, direction: "up" | "down") => void;
}) {
  const selected = selectedStepId != null ? steps.find((s) => s.id === selectedStepId) : undefined;
  const stepIndex = selected != null ? steps.findIndex((s) => s.id === selected.id) : -1;

  if (steps.length === 0) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/80 bg-muted/5 px-8 py-16 text-center">
        <div className="rounded-full bg-muted/60 p-4">
          <Mail className="h-8 w-8 text-muted-foreground/60" strokeWidth={1.5} aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">No emails in this sequence yet</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Add the first touch. Steps run in order; you set the wait time before each send.
          </p>
        </div>
        <Button type="button" onClick={onAddStep}>
          <Plus className="mr-2 h-4 w-4" />
          Add first step
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm ring-1 ring-border/40">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:divide-x lg:divide-border/80">
        <div className="flex min-h-[400px] flex-col lg:min-h-[520px]">
          <div className="border-b border-border/80 bg-muted/20 px-5 py-4">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Touchpoints</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {steps.length} step{steps.length === 1 ? "" : "s"} · linear order · select a row to edit the email
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
            <ol className="relative space-y-0">
              {steps.map((step, i) => {
                const isSelected = step.id === selectedStepId;
                const isFirst = i === 0;
                const isLast = i === steps.length - 1;
                return (
                  <li key={String(step.id)} className="relative flex gap-3 pb-6 last:pb-0 sm:gap-4">
                    {!isLast ? (
                      <div
                        className="absolute left-[18px] top-[2.5rem] z-0 h-[calc(100%-0.5rem)] w-px bg-border sm:left-[19px]"
                        aria-hidden
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onSelectStep(step.id)}
                      className={cn(
                        "relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors sm:h-10 sm:w-10",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary ring-offset-2 ring-offset-background"
                          : "border border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                      aria-current={isSelected ? "true" : undefined}
                    >
                      {i + 1}
                    </button>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onSelectStep(step.id)}
                        className={cn(
                          "w-full rounded-xl border px-3 py-3 text-left transition-colors sm:px-4",
                          isSelected
                            ? "border-primary/50 bg-primary/5 shadow-sm"
                            : "border-border/80 bg-background hover:border-border hover:bg-muted/30"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{step.name || `Step ${i + 1}`}</p>
                            {step.subject?.trim() ? (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">{step.subject}</p>
                            ) : (
                              <p className="mt-0.5 text-xs italic text-muted-foreground/80">No subject yet</p>
                            )}
                          </div>
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            <Clock className="h-3 w-3" aria-hidden />
                            {formatWaitLabel(Number(step.delayHours) || 0, i)}
                          </span>
                        </div>
                      </button>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveStep(step.id, "up");
                          }}
                          disabled={isFirst}
                          aria-label="Move step up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveStep(step.id, "down");
                          }}
                          disabled={isLast}
                          aria-label="Move step down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <Button type="button" variant="outline" className="mt-2 w-full border-dashed" onClick={onAddStep}>
              <Plus className="mr-2 h-4 w-4" />
              Add email step
            </Button>
          </div>
        </div>

        <aside className="flex min-h-[320px] flex-col border-t border-border/80 bg-gradient-to-b from-muted/10 to-card lg:min-h-0 lg:border-t-0">
          {selected && stepIndex >= 0 ? (
            <>
              <div className="border-b border-border/80 px-5 py-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                  Email
                </div>
                <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-foreground">
                  Step {stepIndex + 1}
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">of {steps.length}</span>
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">Fields for this touch only. Save the sequence when you are done.</p>
              </div>
              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="panel-step-name">
                    Internal label
                  </label>
                  <Input
                    id="panel-step-name"
                    value={selected.name}
                    onChange={(e) => onUpdateStep(selected.id, "name", e.target.value)}
                    placeholder="e.g. Day 3 — follow-up"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="panel-step-wait">
                    Wait before this send
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id="panel-step-wait"
                      type="number"
                      min={0}
                      className="h-10 w-28"
                      value={selected.delayHours}
                      onChange={(e) => onUpdateStep(selected.id, "delayHours", Number(e.target.value) || 0)}
                    />
                    <span className="text-sm text-muted-foreground">hours</span>
                  </div>
                  {stepIndex === 0 ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      First email: use <strong className="font-medium text-foreground/90">0</strong> to send as soon as someone is enrolled.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Elapsed time after the previous step fires.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="panel-step-subj">
                    Subject line
                  </label>
                  <Input
                    id="panel-step-subj"
                    value={selected.subject || ""}
                    onChange={(e) => onUpdateStep(selected.id, "subject", e.target.value)}
                    placeholder="Inbox preview"
                    className="h-10"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("w-full justify-center gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive")}
                  onClick={() => onRemoveStep(selected.id)}
                  disabled={steps.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove this step
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="rounded-full bg-muted/60 p-4">
                <Mail className="h-7 w-7 text-muted-foreground/50" strokeWidth={1.5} aria-hidden />
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">Choose a step</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">Select a numbered touch on the left to edit label, timing, and subject.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
