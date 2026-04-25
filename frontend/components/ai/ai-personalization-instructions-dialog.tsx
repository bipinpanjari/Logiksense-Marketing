"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  AI_PERSONALIZATION_INSTRUCTIONS_MAX_CHARS,
  getAiSettings,
  updateAiSettings,
} from "@/lib/ai";

export function AiPersonalizationInstructionsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError("");
    setSuccess("");
    setLoading(true);
    void (async () => {
      try {
        const s = await getAiSettings();
        if (cancelled) return;
        setDraft(s.aiPersonalizationInstructions ?? "");
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function onSave() {
    const t = draft.trim();
    if (t.length > AI_PERSONALIZATION_INSTRUCTIONS_MAX_CHARS) {
      setError(
        `At most ${AI_PERSONALIZATION_INSTRUCTIONS_MAX_CHARS.toLocaleString()} characters.`,
      );
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateAiSettings({ aiPersonalizationInstructions: t || null });
      setSuccess("Saved.");
      window.setTimeout(() => onOpenChange(false), 500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="AI workspace instructions"
      description="Anything your team wants the model to respect: your business, ICP, tone, taboo topics, compliance, proof points. Used for icebreakers and scraper research briefs when AI personalization is on."
      maxWidthClassName="max-w-lg"
    >
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
          Loading…
        </p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <textarea
              className="flex min-h-[220px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={AI_PERSONALIZATION_INSTRUCTIONS_MAX_CHARS}
              placeholder="e.g. We sell X to mid-market logistics in DACH. Never claim certifications we don't list. Prefer direct, no-hype tone…"
              disabled={saving}
              aria-label="Workspace instructions for AI"
            />
            <p className="text-[11px] text-muted-foreground">
              {draft.length.toLocaleString()} / {AI_PERSONALIZATION_INSTRUCTIONS_MAX_CHARS.toLocaleString()}{" "}
              characters
            </p>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? (
            <p className="text-sm text-positive-fg">{success}</p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void onSave()}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
