"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSequence } from "@/lib/marketing-email";
import { SequenceBasicsCard } from "@/components/email/sequence-basics-card";
import { SequenceStepsPanel, type SequenceStep } from "@/components/email/sequence-steps-panel";

export default function NewSequencePage() {
  const router = useRouter();
  const firstStepId = useRef(`step-${Date.now()}`).current;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [steps, setSteps] = useState<SequenceStep[]>([
    { id: firstStepId, name: "Step 1", delayHours: 0, subject: "" },
  ]);
  const [selectedStepId, setSelectedStepId] = useState<number | string | null>(firstStepId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function addStep() {
    const newId = `step-${Date.now()}`;
    setSteps((prev) => [
      ...prev,
      { id: newId, name: `Step ${prev.length + 1}`, delayHours: prev.length === 0 ? 0 : 24, subject: "" },
    ]);
    setSelectedStepId(newId);
  }

  function updateStep(stepId: number | string, field: keyof SequenceStep, value: string | number) {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, [field]: value } : s)));
  }

  function removeStep(stepId: number | string) {
    setSteps((prev) => {
      const next = prev.filter((s) => s.id !== stepId);
      if (selectedStepId === stepId) {
        setSelectedStepId(next[0]?.id ?? null);
      }
      return next;
    });
  }

  function moveStep(stepId: number | string, direction: "up" | "down") {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === stepId);
      if (idx < 0) return prev;
      const j = direction === "up" ? idx - 1 : idx + 1;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  async function onCreate() {
    if (!name.trim()) {
      setMessage("Give your sequence a name");
      return;
    }
    if (steps.length === 0) {
      setMessage("Add at least one step");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const created = await createSequence({
        name: name.trim(),
        description: description.trim(),
        status,
        steps: steps.map((s) => ({
          id: s.id,
          name: s.name,
          delayHours: Number(s.delayHours) || 0,
          subject: s.subject,
        })),
      });
      const newId = created?.id;
      if (!newId) {
        setMessage("Created but no id returned — check the sequence list");
        router.push("/email/sequences");
        return;
      }
      router.push(`/email/sequences/${newId}`);
    } catch (e: any) {
      setMessage(e?.message || "Failed to create sequence");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/email/sequences" className="underline-offset-4 hover:underline">
              Sequences
            </Link>
            <span>/</span>
            <span>New</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">New sequence</h1>
          <p className="text-sm text-muted-foreground">
            Ordered email touches with wait times between sends — edit the chain on the left, details on the right.
          </p>
        </div>
        <Button onClick={onCreate} disabled={saving || !name.trim() || steps.length === 0} size="default">
          {saving ? "Creating…" : "Create sequence"}
        </Button>
      </div>

      <SequenceBasicsCard
        name={name}
        description={description}
        status={status}
        onName={setName}
        onDescription={setDescription}
        onStatus={setStatus}
        statusOptions={[
          { value: "draft", label: "Draft" },
          { value: "active", label: "Active" },
          { value: "paused", label: "Paused" },
          { value: "archived", label: "Archived" },
        ]}
      />

      <SequenceStepsPanel
        steps={steps}
        selectedStepId={selectedStepId}
        onSelectStep={setSelectedStepId}
        onAddStep={addStep}
        onUpdateStep={updateStep}
        onRemoveStep={removeStep}
        onMoveStep={moveStep}
      />

      {message ? <p className="text-sm text-amber-600 dark:text-amber-500">{message}</p> : null}
    </div>
  );
}
