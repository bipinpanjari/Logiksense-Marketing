"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Step {
  id: number;
  name: string;
  delayHours: number;
  subject: string;
}

export default function NewSequencePage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<Step[]>([{ id: 1, name: "Step 1", delayHours: 0, subject: "" }]);

  function addStep() {
    setSteps((prev) => [
      ...prev,
      { id: Date.now(), name: `Step ${prev.length + 1}`, delayHours: 24, subject: "" },
    ]);
  }

  function updateStep(id: number, field: keyof Step, value: string | number) {
    setSteps((prev) => prev.map((step) => (step.id === id ? { ...step, [field]: value } : step)));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Build New Sequence</h1>
        <p className="text-sm text-muted-foreground">Design multi-step sequence logic with consistent timing and messaging.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sequence Basics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Sequence Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Founder outbound sequence" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="min-h-[100px] w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sequence Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.map((step) => (
            <div key={step.id} className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-3">
              <Input value={step.name} onChange={(e) => updateStep(step.id, "name", e.target.value)} />
              <Input
                type="number"
                value={step.delayHours}
                onChange={(e) => updateStep(step.id, "delayHours", Number(e.target.value))}
                placeholder="Delay hours"
              />
              <Input value={step.subject} onChange={(e) => updateStep(step.id, "subject", e.target.value)} placeholder="Email subject" />
            </div>
          ))}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={addStep}>
              Add Step
            </Button>
            <Button>Create Sequence</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

