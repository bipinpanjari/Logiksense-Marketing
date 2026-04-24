"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createTemplate, listTemplates } from "@/lib/marketing-email";

export default function EmailTemplatesPage() {
  const [library, setLibrary] = useState<Array<{ id: string; name: string; subject: string; body_html?: string }>>([]);
  const [name, setName] = useState("Cold Intro");
  const [subject, setSubject] = useState("Quick question about {{companyName}}");
  const [body, setBody] = useState("Hi {{firstName}},\n\nI noticed {{companyName}} is scaling {{department}}...");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  async function loadTemplates() {
    setLoading(true);
    setMessage("");
    try {
      const data = await listTemplates();
      const normalized = (Array.isArray(data) ? data : []).map((t: any) => ({
        id: t.id,
        name: t.name,
        subject: t.subject,
        body_html: t.body_html,
      }));
      setLibrary(normalized);
      if (normalized.length > 0) {
        setName(normalized[0].name);
        setSubject(normalized[0].subject);
        setBody(normalized[0].body_html || "");
      }
    } catch (e: any) {
      setMessage(e?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  async function onSaveTemplate() {
    setSaving(true);
    setMessage("");
    try {
      await createTemplate({ name, subject, bodyHtml: body });
      setMessage("Template saved");
      await loadTemplates();
    } catch (e: any) {
      setMessage(e?.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

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
            {loading ? <p className="text-sm text-muted-foreground">Loading templates...</p> : null}
            {library.map((item) => (
              <button
                key={item.id}
                className="w-full rounded-md border border-border p-3 text-left text-sm hover:bg-muted"
                onClick={() => {
                  setName(item.name);
                  setSubject(item.subject);
                  setBody(item.body_html || "");
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
              <Button onClick={onSaveTemplate} disabled={saving}>
                {saving ? "Saving..." : "Save Template"}
              </Button>
              <Button variant="outline" onClick={() => setPreviewOpen((v) => !v)}>
                {previewOpen ? "Hide Preview" : "Preview"}
              </Button>
            </div>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            {previewOpen ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Rendered preview</label>
                <div className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
                  Subject: <span className="font-mono text-foreground">{renderVars(subject)}</span>
                </div>
                <iframe
                  title="Template preview"
                  className="min-h-[360px] w-full rounded-md border border-border bg-white"
                  srcDoc={wrapHtml(renderVars(body))}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function renderVars(input: string): string {
  const sample: Record<string, string> = {
    firstName: "Alex",
    lastName: "Rivera",
    companyName: "Acme, Inc.",
    company: "Acme, Inc.",
    email: "alex@acme.com",
    jobTitle: "Head of Operations",
    department: "its ops team",
  };
  return input.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => sample[key] ?? `{{${key}}}`);
}

function wrapHtml(body: string): string {
  const looksLikeHtml = /<\w+[\s>]/.test(body);
  const content = looksLikeHtml
    ? body
    : `<pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;">${escapeHtml(body)}</pre>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color:#111; padding:16px; }
  </style></head><body>${content}</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]!));
}

