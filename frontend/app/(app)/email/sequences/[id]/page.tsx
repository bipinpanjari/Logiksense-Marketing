"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSequence, updateSequence } from "@/lib/marketing-email";

interface Step {
  id: number | string;
  name: string;
  delayHours: number;
  subject?: string;
}

export default function SequenceEditPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [steps, setSteps] = useState<Step[]>([]);
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
        const parsed: Step[] = Array.isArray(data?.steps)
          ? data.steps
          : typeof data?.steps === "string"
          ? JSON.parse(data.steps)
          : [];
        setSteps(parsed);
      } catch (e: any) {
        setMessage(e?.message || "Failed to load sequence");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function addStep() {
    setSteps((prev) => [
      ...prev,
      { id: Date.now(), name: `Step ${prev.length + 1}`, delayHours: 24, subject: "" },
    ]);
  }

  function updateStep(stepId: number | string, field: keyof Step, value: string | number) {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, [field]: value } : s)));
  }

  function removeStep(stepId: number | string) {
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/email/sequences" className="underline-offset-4 hover:underline">
              Sequences
            </Link>
            <span>/</span>
            <span>{name || "Edit"}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit Sequence</h1>
        </div>
        <Button onClick={save} disabled={saving || !name.trim() || steps.length === 0}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Status</label>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((s, i) => (
            <div key={s.id} className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[40px_1fr_120px_1fr_auto]">
              <div className="flex items-center text-sm text-muted-foreground">#{i + 1}</div>
              <Input value={s.name} onChange={(e) => updateStep(s.id, "name", e.target.value)} placeholder="Step name" />
              <Input
                type="number"
                min={0}
                value={s.delayHours}
                onChange={(e) => updateStep(s.id, "delayHours", Number(e.target.value) || 0)}
                placeholder="Delay (hours)"
              />
              <Input
                value={s.subject || ""}
                onChange={(e) => updateStep(s.id, "subject", e.target.value)}
                placeholder="Subject (optional preview)"
              />
              <Button variant="outline" onClick={() => removeStep(s.id)}>
                Remove
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={addStep}>
            Add Step
          </Button>
        </CardContent>
      </Card>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
