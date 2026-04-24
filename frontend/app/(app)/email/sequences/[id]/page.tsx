"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getSequence, updateSequence } from "@/lib/marketing-email";
import { SequenceBasicsCard } from "@/components/email/sequence-basics-card";
import { SequenceStepsPanel, type SequenceStep } from "@/components/email/sequence-steps-panel";

export default function SequenceEditPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<number | string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getSequence(id);
        setName(data?.name || "");
        setDescription(data?.description || "");
        setStatus(data?.status || "draft");
        const parsed: SequenceStep[] = Array.isArray(data?.steps)
          ? data.steps
          : typeof data?.steps === "string"
            ? JSON.parse(data.steps)
            : [];
        setSteps(parsed);
        if (parsed.length > 0) {
          setSelectedStepId(parsed[0].id);
        }
      } catch (e: any) {
        setMessage(e?.message || "Failed to load sequence");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function addStep() {
    const newId = Date.now();
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

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      await updateSequence(id, { name, description, status, steps });
      setMessage("Saved");
    } catch (e: any) {
      setMessage(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/email/sequences" className="underline-offset-4 hover:underline">
              Sequences
            </Link>
            <span>/</span>
            <span className="truncate">{name || "Edit"}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit sequence</h1>
          <p className="text-sm text-muted-foreground">Reorder touches, adjust waits and subjects, then save.</p>
        </div>
        <Button onClick={save} disabled={saving || !name.trim() || steps.length === 0}>
          {saving ? "Saving…" : "Save"}
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

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
