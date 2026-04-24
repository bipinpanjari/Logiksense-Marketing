"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import {
  SearchProfile,
  ScraperStatus,
  acceptScraperTos,
  createSearchProfile,
  deleteSearchProfile,
  disableScraper,
  getScraperStatus,
  listSearchProfiles,
  runAdhocScrape,
  runSearchProfile,
  updateSearchProfile,
} from "@/lib/scraper";

interface ProfileForm {
  name: string;
  businessType: string;
  city: string;
  country: string;
  targetLimit: number;
  scheduleCron: string;
}

const EMPTY_FORM: ProfileForm = {
  name: "",
  businessType: "",
  city: "",
  country: "",
  targetLimit: 20,
  scheduleCron: "",
};

export default function ScraperPage() {
  const [status, setStatus] = useState<ScraperStatus | null>(null);
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // profile editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);

  // ad-hoc run
  const [adhocOpen, setAdhocOpen] = useState(false);
  const [adhoc, setAdhoc] = useState({ businessType: "", city: "", country: "", targetLimit: 10 });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [s, p] = await Promise.all([getScraperStatus(), listSearchProfiles()]);
      setStatus(s);
      setProfiles(p);
    } catch (e: any) {
      setError(e?.message || "Failed to load scraper state");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onAcceptTos() {
    setBusy(true);
    try {
      await acceptScraperTos();
      setMessage("Scraping enabled for this workspace.");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to accept ToS");
    } finally {
      setBusy(false);
    }
  }

  async function onDisable() {
    if (!confirm("Disable scraping for this workspace? Running jobs will finish, but nothing new will start.")) return;
    setBusy(true);
    try {
      await disableScraper();
      setMessage("Scraping disabled for this workspace.");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to disable scraping");
    } finally {
      setBusy(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  }

  function openEdit(p: SearchProfile) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      businessType: p.business_type,
      city: p.city || "",
      country: p.country || "",
      targetLimit: p.target_limit,
      scheduleCron: p.schedule_cron || "",
    });
    setEditorOpen(true);
  }

  async function submitProfile() {
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        businessType: form.businessType.trim(),
        city: form.city || undefined,
        country: form.country || undefined,
        targetLimit: Number(form.targetLimit) || 20,
        scheduleCron: form.scheduleCron.trim() || null,
      };
      if (editingId) {
        await updateSearchProfile(editingId, payload);
        setMessage("Profile updated.");
      } else {
        await createSearchProfile(payload);
        setMessage("Profile created.");
      }
      setEditorOpen(false);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to save profile");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteProfile(id: string) {
    if (!confirm("Delete this search profile?")) return;
    setBusy(true);
    try {
      await deleteSearchProfile(id);
      setMessage("Profile deleted.");
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to delete profile");
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive(p: SearchProfile) {
    setBusy(true);
    try {
      await updateSearchProfile(p.id, { isActive: !p.is_active });
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to toggle profile");
    } finally {
      setBusy(false);
    }
  }

  async function onRunProfile(id: string) {
    setBusy(true);
    try {
      const res = await runSearchProfile(id);
      setMessage(`Queued scrape job ${res.jobId}.`);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to run profile");
    } finally {
      setBusy(false);
    }
  }

  async function onRunAdhoc() {
    setBusy(true);
    try {
      const res = await runAdhocScrape({
        businessType: adhoc.businessType,
        city: adhoc.city || undefined,
        country: adhoc.country || undefined,
        targetLimit: Number(adhoc.targetLimit) || 10,
      });
      setMessage(`Queued ad-hoc scrape ${res.jobId}.`);
      setAdhocOpen(false);
    } catch (e: any) {
      setError(e?.message || "Failed to queue ad-hoc scrape");
    } finally {
      setBusy(false);
    }
  }

  const tosRequired = !status?.enabled || !status?.tosAcceptedAt;
  const globalKill = !!status?.globalKillSwitch;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Search Profiles</h1>
        <p className="text-sm text-muted-foreground">
          Define reusable Google Maps searches and optional cron schedules. Results are extracted, enriched with
          website emails, and promoted to leads automatically.
        </p>
      </div>

      {globalKill ? (
        <Card className="border-destructive/60">
          <CardHeader>
            <CardTitle className="text-base">Scraping globally disabled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              An operator has flipped the global kill-switch (SCRAPER_KILL_SWITCH). New jobs will be rejected.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card className={tosRequired ? "border-amber-500/60" : undefined}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Terms of Service & Kill-switch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tosRequired ? (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/5 p-3 text-sm">
              <p className="font-medium">Before enabling scraping, review and accept the scraping ToS.</p>
              <p className="mt-2 text-muted-foreground">
                Scraping public Google Maps and company websites may be subject to third-party terms. You are
                responsible for respecting robots.txt, rate limits, and local privacy law (GDPR/CCPA). You can
                disable scraping workspace-wide at any time.
              </p>
              <div className="mt-3 flex gap-2">
                <Button disabled={busy} onClick={onAcceptTos}>I understand, enable scraping</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 p-3 text-sm">
              <div>
                <p className="font-medium">Scraping enabled</p>
                <p className="text-xs text-muted-foreground">
                  Accepted {status?.tosAcceptedAt ? new Date(status.tosAcceptedAt).toLocaleString() : "-"}
                </p>
              </div>
              <Button variant="outline" disabled={busy} onClick={onDisable}>
                Disable scraping
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={openCreate} disabled={tosRequired || globalKill}>New profile</Button>
        <Button variant="outline" onClick={() => setAdhocOpen(true)} disabled={tosRequired || globalKill}>
          Ad-hoc scrape
        </Button>
        <Link href="/scraper/jobs" className="ml-auto text-sm underline-offset-4 hover:underline">
          View jobs &rarr;
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profiles</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading profiles...</p>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No profiles yet. Create one to start scraping.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Business Type</th>
                    <th className="px-3 py-2 text-left font-medium">Location</th>
                    <th className="px-3 py-2 text-left font-medium">Limit</th>
                    <th className="px-3 py-2 text-left font-medium">Cron</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.id} className="border-b">
                      <td className="px-3 py-2">{p.name}</td>
                      <td className="px-3 py-2">{p.business_type}</td>
                      <td className="px-3 py-2">{[p.city, p.country].filter(Boolean).join(", ") || "-"}</td>
                      <td className="px-3 py-2">{p.target_limit}</td>
                      <td className="px-3 py-2">{p.schedule_cron || "-"}</td>
                      <td className="px-3 py-2">{p.is_active ? "Active" : "Paused"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" onClick={() => onRunProfile(p.id)} disabled={busy || tosRequired || globalKill}>
                            Run
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onToggleActive(p)}>
                            {p.is_active ? "Pause" : "Resume"}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => onDeleteProfile(p.id)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        title={editingId ? "Edit profile" : "New search profile"}
        description="Configure a reusable Google Maps search. Optionally add a cron expression to run it automatically."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Name (e.g. Dallas dentists)" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
          <Input placeholder="Business type (e.g. dentist)" value={form.businessType} onChange={(e) => setForm((s) => ({ ...s, businessType: e.target.value }))} />
          <Input placeholder="City" value={form.city} onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))} />
          <Input placeholder="Country" value={form.country} onChange={(e) => setForm((s) => ({ ...s, country: e.target.value }))} />
          <Input
            type="number"
            placeholder="Target limit"
            value={form.targetLimit}
            onChange={(e) => setForm((s) => ({ ...s, targetLimit: Number(e.target.value) }))}
          />
          <Input
            placeholder="Cron (optional, e.g. 0 7 * * 1)"
            value={form.scheduleCron}
            onChange={(e) => setForm((s) => ({ ...s, scheduleCron: e.target.value }))}
          />
          <div className="md:col-span-2 mt-2 flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button disabled={busy || !form.name || !form.businessType} onClick={submitProfile}>
              {busy ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={adhocOpen}
        onOpenChange={setAdhocOpen}
        title="Run ad-hoc scrape"
        description="One-off scrape without saving a profile."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Business type" value={adhoc.businessType} onChange={(e) => setAdhoc((s) => ({ ...s, businessType: e.target.value }))} />
          <Input placeholder="City" value={adhoc.city} onChange={(e) => setAdhoc((s) => ({ ...s, city: e.target.value }))} />
          <Input placeholder="Country" value={adhoc.country} onChange={(e) => setAdhoc((s) => ({ ...s, country: e.target.value }))} />
          <Input
            type="number"
            placeholder="Target limit"
            value={adhoc.targetLimit}
            onChange={(e) => setAdhoc((s) => ({ ...s, targetLimit: Number(e.target.value) }))}
          />
          <div className="md:col-span-2 mt-2 flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setAdhocOpen(false)}>Cancel</Button>
            <Button disabled={busy || !adhoc.businessType} onClick={onRunAdhoc}>
              {busy ? "Queuing..." : "Run now"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
