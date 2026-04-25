"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Callout } from "@/components/ui/callout";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/layout/page-shell";
import {
  AI_PERSONALIZATION_INSTRUCTIONS_MAX_CHARS,
  type AiLlmVendor,
  type AiSettings,
  getAiSettings,
  previewIcebreaker,
  updateAiSettings,
} from "@/lib/ai";

function connectionStatus(s: AiSettings): { ok: boolean; label: string } {
  if (s.aiProvider === "platform") {
    if (s.aiLlmVendor === "anthropic") {
      return s.platformAnthropicAvailable
        ? { ok: true, label: "Claude is available for this workspace." }
        : {
            ok: false,
            label: "Claude isn’t available through your organization yet. You can add your own Anthropic key below.",
          };
    }
    return s.platformOpenAiAvailable
      ? { ok: true, label: "OpenAI is available for this workspace." }
      : {
          ok: false,
          label: "OpenAI isn’t available through your organization yet. You can add your own OpenAI key below.",
        };
  }
  if (s.aiLlmVendor === "anthropic") {
    return s.aiAnthropicConfigured
      ? { ok: true, label: "Using your Anthropic key." }
      : { ok: false, label: "Add your Anthropic key to use Claude." };
  }
  return s.aiOpenaiConfigured
    ? { ok: true, label: "Using your OpenAI key." }
    : { ok: false, label: "Add your OpenAI key to generate AI copy." };
}

export default function AiSettingsPage() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [modelDraft, setModelDraft] = useState("");

  const [zerobounce, setZerobounce] = useState("");
  const [apollo, setApollo] = useState("");

  const [previewCompany, setPreviewCompany] = useState("");
  const [previewIndustry, setPreviewIndustry] = useState("");
  const [previewResult, setPreviewResult] = useState("");
  const [instructionsDraft, setInstructionsDraft] = useState("");

  const status = useMemo(() => (settings ? connectionStatus(settings) : null), [settings]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const s = await getAiSettings();
      setSettings(s);
      setModelDraft(s.aiPreferredModel ?? "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (settings) setInstructionsDraft(settings.aiPersonalizationInstructions ?? "");
  }, [settings]);

  async function runUpdate(
    body: Parameters<typeof updateAiSettings>[0],
    success: string,
  ) {
    setBusy(true);
    setError("");
    try {
      const updated = await updateAiSettings(body);
      setSettings(updated);
      setModelDraft(updated.aiPreferredModel ?? "");
      setMessage(success);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onToggleAi(next: boolean) {
    await runUpdate(
      { aiPersonalizationEnabled: next },
      next ? "AI personalization is on." : "AI personalization is off.",
    );
  }

  async function onToggleEnrichment(next: boolean) {
    await runUpdate(
      { enrichmentEnabled: next },
      next ? "Enrichment is on." : "Enrichment is off.",
    );
  }

  async function onSetVendor(v: AiLlmVendor) {
    await runUpdate(
      { aiLlmVendor: v },
      v === "anthropic" ? "Claude is now your AI model." : "OpenAI is now your AI model.",
    );
  }

  async function onSetCredentialMode(mode: "platform" | "byok") {
    await runUpdate(
      { aiProvider: mode },
      mode === "byok"
        ? "You’ll use API keys from this workspace."
        : "You’ll use your organization’s AI connection when it’s available.",
    );
  }

  async function onSaveModel() {
    const trimmed = modelDraft.trim();
    await runUpdate(
      { aiPreferredModel: trimmed || null },
      trimmed ? "Model preference saved." : "Cleared — the recommended model will be used.",
    );
  }

  async function onSaveOpenAi() {
    if (!openaiKey) return;
    setBusy(true);
    setError("");
    try {
      const updated = await updateAiSettings({ openaiApiKey: openaiKey, aiProvider: "byok" });
      setSettings(updated);
      setOpenaiKey("");
      setMessage("OpenAI key saved securely.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onClearOpenAi() {
    if (!confirm("Remove the saved OpenAI key for this workspace?")) return;
    await runUpdate({ openaiApiKey: null }, "OpenAI key removed.");
  }

  async function onSaveAnthropic() {
    if (!anthropicKey) return;
    setBusy(true);
    setError("");
    try {
      const updated = await updateAiSettings({ anthropicApiKey: anthropicKey, aiProvider: "byok" });
      setSettings(updated);
      setAnthropicKey("");
      setMessage("Anthropic key saved securely.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onClearAnthropic() {
    if (!confirm("Remove the saved Anthropic key for this workspace?")) return;
    await runUpdate({ anthropicApiKey: null }, "Anthropic key removed.");
  }

  async function saveProvider(provider: "zerobounce" | "apollo", key: string, clear = false) {
    setBusy(true);
    try {
      const body =
        provider === "zerobounce"
          ? { zerobounceApiKey: clear ? null : key }
          : { apolloApiKey: clear ? null : key };
      const updated = await updateAiSettings(body);
      setSettings(updated);
      if (provider === "zerobounce") setZerobounce("");
      if (provider === "apollo") setApollo("");
      setMessage(provider === "zerobounce" ? "ZeroBounce updated." : "Apollo updated.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPreviewIcebreaker() {
    if (!previewCompany) return;
    setBusy(true);
    setError("");
    setPreviewResult("");
    try {
      const r = await previewIcebreaker({
        companyName: previewCompany,
        industry: previewIndustry || undefined,
      });
      setPreviewResult(
        r.icebreaker ||
          "No line generated. Turn on personalization and make sure your AI connection is ready.",
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <PageShell narrow>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </PageShell>
    );
  }
  if (!settings) {
    return (
      <PageShell narrow>
        <Callout variant="destructive">Could not load AI settings.</Callout>
      </PageShell>
    );
  }

  return (
    <PageShell narrow>
      <PageHeader
        title="AI & enrichment"
        description={
          <>
            Icebreakers, research briefs, and optional email enrichment.{" "}
            <Link href="/ai/usage" className="font-medium text-foreground underline underline-offset-4">
              View usage
            </Link>
          </>
        }
      />

      {error ? <Callout variant="destructive">{error}</Callout> : null}
      {message ? <Callout variant="success">{message}</Callout> : null}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>AI personalization</CardTitle>
                <CardDescription>
                  Turns AI-written icebreakers and briefs on or off for this workspace.
                </CardDescription>
              </div>
              <Badge variant={settings.aiPersonalizationEnabled ? "success" : "outline"}>
                {settings.aiPersonalizationEnabled ? "On" : "Off"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              variant={settings.aiPersonalizationEnabled ? "outline" : "default"}
              disabled={busy}
              onClick={() => onToggleAi(!settings.aiPersonalizationEnabled)}
            >
              {settings.aiPersonalizationEnabled ? "Turn off" : "Turn on"}
            </Button>

            <div className="space-y-2 rounded-md border border-border/60 bg-muted/10 p-4">
              <div>
                <p className="text-sm font-medium">Workspace instructions</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                  Optional free text the model must follow: what you sell, who you serve, tone, words to avoid,
                  compliance, proof you allow mentioning. Applies to icebreakers and scraper rep briefs.
                </p>
              </div>
              <textarea
                className="flex min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={instructionsDraft}
                onChange={(e) => setInstructionsDraft(e.target.value)}
                maxLength={AI_PERSONALIZATION_INSTRUCTIONS_MAX_CHARS}
                placeholder="Describe your business, motion, and rules for the model…"
                disabled={busy}
                aria-label="Workspace AI instructions"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  {instructionsDraft.length.toLocaleString()} /{" "}
                  {AI_PERSONALIZATION_INSTRUCTIONS_MAX_CHARS.toLocaleString()} characters
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void runUpdate(
                      { aiPersonalizationInstructions: instructionsDraft.trim() || null },
                      "Workspace instructions saved.",
                    )
                  }
                >
                  Save instructions
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Model provider</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose who powers the text. Keys you save are encrypted and never shown back in the app.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSetVendor("openai")}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-colors",
                    settings.aiLlmVendor === "openai"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <div className="text-sm font-medium">OpenAI</div>
                  <p className="mt-1 text-xs text-muted-foreground leading-snug">
                    GPT models for icebreakers and account briefs.
                  </p>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSetVendor("anthropic")}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-colors",
                    settings.aiLlmVendor === "anthropic"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <div className="text-sm font-medium">Claude</div>
                  <p className="mt-1 text-xs text-muted-foreground leading-snug">
                    Anthropic models for the same workflows.
                  </p>
                </button>
              </div>
            </div>

            <div className="rounded-md border p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Connection</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Use your organization’s access, or connect with your own API keys.
                  </p>
                </div>
                <div className="flex rounded-md border bg-background p-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={settings.aiProvider === "platform" ? "default" : "ghost"}
                    className="rounded-md"
                    disabled={busy}
                    onClick={() => onSetCredentialMode("platform")}
                  >
                    Organization
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={settings.aiProvider === "byok" ? "default" : "ghost"}
                    className="rounded-md"
                    disabled={busy}
                    onClick={() => onSetCredentialMode("byok")}
                  >
                    Your keys
                  </Button>
                </div>
              </div>

              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-xs",
                  status?.ok ? "border-positive-border/60 bg-positive-bg text-positive-fg" : "border-caution-border/60 bg-caution-bg text-caution-fg",
                )}
              >
                {status?.label}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Model name (optional)</label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="max-w-md"
                    placeholder={
                      settings.aiLlmVendor === "anthropic"
                        ? "e.g. Claude Sonnet — or leave blank"
                        : "e.g. GPT-4o mini — or leave blank"
                    }
                    value={modelDraft}
                    onChange={(e) => setModelDraft(e.target.value)}
                  />
                  <Button type="button" variant="secondary" disabled={busy} onClick={onSaveModel}>
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave blank to use the recommended model for the provider you selected.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">OpenAI key</span>
                    <Badge variant={settings.aiOpenaiConfigured ? "success" : "outline"} className="text-[10px]">
                      {settings.aiOpenaiConfigured ? "Saved" : "None"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      type="password"
                      className="min-w-0 flex-1"
                      placeholder={settings.aiOpenaiConfigured ? "Enter a new key to replace" : "Paste key"}
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                    />
                    <Button size="sm" disabled={busy || !openaiKey} onClick={onSaveOpenAi}>
                      Save
                    </Button>
                    {settings.aiOpenaiConfigured && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={onClearOpenAi}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Anthropic key</span>
                    <Badge variant={settings.aiAnthropicConfigured ? "success" : "outline"} className="text-[10px]">
                      {settings.aiAnthropicConfigured ? "Saved" : "None"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      type="password"
                      className="min-w-0 flex-1"
                      placeholder={settings.aiAnthropicConfigured ? "Enter a new key to replace" : "Paste key"}
                      value={anthropicKey}
                      onChange={(e) => setAnthropicKey(e.target.value)}
                    />
                    <Button size="sm" disabled={busy || !anthropicKey} onClick={onSaveAnthropic}>
                      Save
                    </Button>
                    {settings.aiAnthropicConfigured && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={onClearAnthropic}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md border p-4 space-y-3">
              <div>
                <p className="text-sm font-medium">Try an icebreaker</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sample output only — nothing is sent to a lead.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Company name"
                  value={previewCompany}
                  onChange={(e) => setPreviewCompany(e.target.value)}
                />
                <Input
                  placeholder="Industry (optional)"
                  value={previewIndustry}
                  onChange={(e) => setPreviewIndustry(e.target.value)}
                />
              </div>
              <Button size="sm" disabled={busy || !previewCompany} onClick={onPreviewIcebreaker}>
                Generate
              </Button>
              {previewResult ? (
                <div className="rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">{previewResult}</div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Lead enrichment</CardTitle>
                <CardDescription>
                  Email verification (ZeroBounce) and contact enrichment (Apollo). Separate from the AI model
                  above.
                </CardDescription>
              </div>
              <Badge variant={settings.enrichmentEnabled ? "success" : "outline"}>
                {settings.enrichmentEnabled ? "On" : "Off"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              variant={settings.enrichmentEnabled ? "outline" : "default"}
              disabled={busy}
              onClick={() => onToggleEnrichment(!settings.enrichmentEnabled)}
            >
              {settings.enrichmentEnabled ? "Turn off enrichment" : "Turn on enrichment"}
            </Button>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-md border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">ZeroBounce</span>
                  <Badge variant={settings.zerobounceConfigured ? "success" : "outline"}>
                    {settings.zerobounceConfigured ? "Ready" : "Missing"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input
                    type="password"
                    className="min-w-0 flex-1"
                    placeholder={settings.zerobounceConfigured ? "New key to replace" : "API key"}
                    value={zerobounce}
                    onChange={(e) => setZerobounce(e.target.value)}
                  />
                  <Button size="sm" disabled={busy || !zerobounce} onClick={() => saveProvider("zerobounce", zerobounce)}>
                    Save
                  </Button>
                  {settings.zerobounceConfigured && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => saveProvider("zerobounce", "", true)}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2 rounded-md border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Apollo</span>
                  <Badge variant={settings.apolloConfigured ? "success" : "outline"}>
                    {settings.apolloConfigured ? "Ready" : "Missing"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input
                    type="password"
                    className="min-w-0 flex-1"
                    placeholder={settings.apolloConfigured ? "New key to replace" : "API key"}
                    value={apollo}
                    onChange={(e) => setApollo(e.target.value)}
                  />
                  <Button size="sm" disabled={busy || !apollo} onClick={() => saveProvider("apollo", apollo)}>
                    Save
                  </Button>
                  {settings.apolloConfigured && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => saveProvider("apollo", "", true)}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
