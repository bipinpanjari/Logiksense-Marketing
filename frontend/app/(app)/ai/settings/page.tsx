"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AiSettings,
  getAiSettings,
  previewIcebreaker,
  updateAiSettings,
} from "@/lib/ai";

export default function AiSettingsPage() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [openai, setOpenai] = useState("");
  const [zerobounce, setZerobounce] = useState("");
  const [apollo, setApollo] = useState("");

  const [previewCompany, setPreviewCompany] = useState("");
  const [previewIndustry, setPreviewIndustry] = useState("");
  const [previewResult, setPreviewResult] = useState<string>("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const s = await getAiSettings();
      setSettings(s);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onToggleAi(next: boolean) {
    setBusy(true);
    setError("");
    try {
      const updated = await updateAiSettings({ aiPersonalizationEnabled: next });
      setSettings(updated);
      setMessage(next ? "AI personalization enabled." : "AI personalization disabled.");
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onToggleEnrichment(next: boolean) {
    setBusy(true);
    setError("");
    try {
      const updated = await updateAiSettings({ enrichmentEnabled: next });
      setSettings(updated);
      setMessage(next ? "Enrichment enabled." : "Enrichment disabled.");
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSelectProvider(provider: "platform" | "byok") {
    setBusy(true);
    setError("");
    try {
      const updated = await updateAiSettings({ aiProvider: provider });
      setSettings(updated);
      setMessage(`AI provider set to ${provider === "byok" ? "your OpenAI key" : "the platform key"}.`);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveOpenAi() {
    if (!openai) return;
    setBusy(true);
    setError("");
    try {
      const updated = await updateAiSettings({ openaiApiKey: openai, aiProvider: "byok" });
      setSettings(updated);
      setOpenai("");
      setMessage("OpenAI key saved securely in the vault.");
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onClearOpenAi() {
    if (!confirm("Remove your OpenAI key? The workspace will fall back to the platform provider.")) return;
    setBusy(true);
    try {
      const updated = await updateAiSettings({ openaiApiKey: null, aiProvider: "platform" });
      setSettings(updated);
      setMessage("OpenAI key removed.");
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveProvider(provider: "zerobounce" | "apollo", key: string, clear = false) {
    setBusy(true);
    try {
      const body = provider === "zerobounce"
        ? { zerobounceApiKey: clear ? null : key }
        : { apolloApiKey: clear ? null : key };
      const updated = await updateAiSettings(body);
      setSettings(updated);
      if (provider === "zerobounce") setZerobounce("");
      if (provider === "apollo") setApollo("");
      setMessage(`${provider} key ${clear ? "removed" : "saved"}.`);
    } catch (e: any) {
      setError(e?.message || "Failed");
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
      setPreviewResult(r.icebreaker || "(no icebreaker — check that AI is enabled and a provider key is configured)");
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!settings) return <div className="p-6 text-sm text-destructive">Failed to load AI settings.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI & Enrichment</h1>
        <p className="text-sm text-muted-foreground">
          Personalization, icebreakers, email validation and Apollo enrichment - all honour the workspace
          kill-switch and every call is metered in the usage log.
        </p>
      </div>

      {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">{message}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>AI personalization</span>
            <Badge variant={settings.aiPersonalizationEnabled ? "success" : "outline"}>
              {settings.aiPersonalizationEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            When enabled, the email dispatcher runs the name detector and icebreaker generator before each
            send. Disabling this is the global kill-switch.
          </p>
          <div className="flex gap-2">
            <Button
              variant={settings.aiPersonalizationEnabled ? "outline" : "default"}
              disabled={busy}
              onClick={() => onToggleAi(!settings.aiPersonalizationEnabled)}
            >
              {settings.aiPersonalizationEnabled ? "Disable" : "Enable"} AI personalization
            </Button>
          </div>

          <div className="rounded-md border p-4">
            <div className="mb-2 text-sm font-medium">Provider</div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={settings.aiProvider === "platform" ? "default" : "outline"}
                disabled={busy}
                onClick={() => onSelectProvider("platform")}
              >
                Platform ({settings.platformKeyAvailable ? "available" : "not configured"})
              </Button>
              <Button
                size="sm"
                variant={settings.aiProvider === "byok" ? "default" : "outline"}
                disabled={busy || !settings.aiOpenaiConfigured}
                onClick={() => onSelectProvider("byok")}
              >
                Your OpenAI key {settings.aiOpenaiConfigured ? "(ready)" : "(add key first)"}
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium">OpenAI API key</label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder={settings.aiOpenaiConfigured ? "•••• stored in vault" : "sk-..."}
                  value={openai}
                  onChange={(e) => setOpenai(e.target.value)}
                />
                <Button disabled={busy || !openai} onClick={onSaveOpenAi}>
                  Save
                </Button>
                {settings.aiOpenaiConfigured && (
                  <Button variant="outline" disabled={busy} onClick={onClearOpenAi}>
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Keys are encrypted with AES-256-GCM and never returned to the UI. Remove your key at any time
                to fall back to the platform-managed key.
              </p>
            </div>
          </div>

          <div className="rounded-md border p-4">
            <div className="mb-2 text-sm font-medium">Icebreaker preview</div>
            <div className="grid gap-2 md:grid-cols-2">
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
            <div className="mt-2 flex gap-2">
              <Button size="sm" disabled={busy || !previewCompany} onClick={onPreviewIcebreaker}>
                Generate preview
              </Button>
            </div>
            {previewResult && (
              <div className="mt-3 rounded border bg-muted/50 p-3 text-sm">{previewResult}</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Enrichment (ZeroBounce + Apollo)</span>
            <Badge variant={settings.enrichmentEnabled ? "success" : "outline"}>
              {settings.enrichmentEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            When enabled, the email dispatcher verifies each recipient through ZeroBounce before sending and
            upgrades generic inboxes (info@, sales@) to personal contacts through Apollo. Both are BYOK - we
            never proxy your keys.
          </p>
          <Button
            variant={settings.enrichmentEnabled ? "outline" : "default"}
            disabled={busy}
            onClick={() => onToggleEnrichment(!settings.enrichmentEnabled)}
          >
            {settings.enrichmentEnabled ? "Disable enrichment" : "Enable enrichment"}
          </Button>

          <div className="rounded-md border p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium">ZeroBounce API key</div>
              <Badge variant={settings.zerobounceConfigured ? "success" : "outline"}>
                {settings.zerobounceConfigured ? "Configured" : "Missing"}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={settings.zerobounceConfigured ? "•••• stored in vault" : "Paste your ZeroBounce API key"}
                value={zerobounce}
                onChange={(e) => setZerobounce(e.target.value)}
              />
              <Button disabled={busy || !zerobounce} onClick={() => saveProvider("zerobounce", zerobounce)}>
                Save
              </Button>
              {settings.zerobounceConfigured && (
                <Button variant="outline" disabled={busy} onClick={() => saveProvider("zerobounce", "", true)}>
                  Remove
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-md border p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium">Apollo API key</div>
              <Badge variant={settings.apolloConfigured ? "success" : "outline"}>
                {settings.apolloConfigured ? "Configured" : "Missing"}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={settings.apolloConfigured ? "•••• stored in vault" : "Paste your Apollo API key"}
                value={apollo}
                onChange={(e) => setApollo(e.target.value)}
              />
              <Button disabled={busy || !apollo} onClick={() => saveProvider("apollo", apollo)}>
                Save
              </Button>
              {settings.apolloConfigured && (
                <Button variant="outline" disabled={busy} onClick={() => saveProvider("apollo", "", true)}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
