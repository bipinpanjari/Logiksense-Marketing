"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const library = [
  { id: "t1", name: "Cold Intro", subject: "Quick question about {{companyName}}" },
  { id: "t2", name: "Follow Up 1", subject: "Should I close your file?" },
  { id: "t3", name: "Meeting Confirm", subject: "Confirming our call for {{date}}" },
];

export default function EmailTemplatesPage() {
  const [name, setName] = useState("Cold Intro");
  const [subject, setSubject] = useState("Quick question about {{companyName}}");
  const [body, setBody] = useState("Hi {{firstName}},\n\nI noticed {{companyName}} is scaling {{department}}...");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email Templates</h1>
        <p className="text-sm text-muted-foreground">Reusable templates with personalization variables and consistent tone.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Template Library</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {library.map((item) => (
              <button
                key={item.id}
                className="w-full rounded-md border border-border p-3 text-left text-sm hover:bg-muted"
                onClick={() => {
                  setName(item.name);
                  setSubject(item.subject);
                }}
              >
                <p className="font-medium">{item.name}</p>
                <p className="text-muted-foreground">{item.subject}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Template Editor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Template Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Body</label>
              <textarea
                className="min-h-[280px] w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button>Save Template</Button>
              <Button variant="outline">Preview</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

