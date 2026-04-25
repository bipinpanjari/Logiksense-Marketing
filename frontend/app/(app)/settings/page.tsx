"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSettings, updateSettings } from "@/lib/account";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { Callout } from "@/components/ui/callout";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/layout/page-shell";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [productUpdates, setProductUpdates] = useState(true);
  const [campaignAlerts, setCampaignAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getSettings();
        setWorkspaceName(data?.name || "");
        const settings = (data?.settings || {}) as Record<string, any>;
        const preferences = (settings.preferences || {}) as Record<string, any>;
        const notifications = (settings.notifications || {}) as Record<string, any>;
        setTimezone(preferences.timezone || "UTC");
        setProductUpdates(notifications.productUpdates ?? true);
        setCampaignAlerts(notifications.campaignAlerts ?? true);
        setWeeklyDigest(notifications.weeklyDigest ?? true);
      } catch (err: any) {
        setError(err?.message || "Failed to load settings");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const data = await updateSettings({
        workspaceName,
        timezone,
        notifications: {
          productUpdates,
          campaignAlerts,
          weeklyDigest,
        },
      });
      setWorkspaceName(data.name || workspaceName);
      setMessage("Settings updated successfully.");
    } catch (err: any) {
      setError(err?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell narrow>
      <PageHeader
        title="Settings"
        description="Workspace preferences that affect your product experience."
      />

      {error ? <Callout variant="destructive">{error}</Callout> : null}
      {message ? <Callout variant="success">{message}</Callout> : null}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>Rename your workspace and set a default timezone.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Loading settings...</p> : null}
            {!loading ? (
              <form className="space-y-5" onSubmit={onSave}>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Workspace name</label>
                  <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="e.g. Acme Workspace" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Timezone</label>
                  <TimezoneSelect
                    value={timezone}
                    onChange={setTimezone}
                    triggerClassName="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm hover:bg-muted"
                    dropdownClassName="absolute left-0 top-full z-20 mt-2 w-full overflow-hidden rounded-lg border border-border bg-card shadow-md"
                  />
                  <p className="text-xs text-muted-foreground">Used for scheduling and calendar-based analytics.</p>
                </div>

                <div className="rounded-md border p-4">
                  <p className="text-sm font-medium">Notifications</p>
                  <div className="mt-3 grid gap-3">
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>
                        <span className="font-medium">Product updates</span>
                        <span className="block text-xs text-muted-foreground">New features, releases, and platform changes.</span>
                      </span>
                      <input type="checkbox" checked={productUpdates} onChange={(e) => setProductUpdates(e.target.checked)} />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>
                        <span className="font-medium">Campaign alerts</span>
                        <span className="block text-xs text-muted-foreground">Important delivery issues and campaign events.</span>
                      </span>
                      <input type="checkbox" checked={campaignAlerts} onChange={(e) => setCampaignAlerts(e.target.checked)} />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm">
                      <span>
                        <span className="font-medium">Weekly digest</span>
                        <span className="block text-xs text-muted-foreground">Summary of performance and engagement.</span>
                      </span>
                      <input type="checkbox" checked={weeklyDigest} onChange={(e) => setWeeklyDigest(e.target.checked)} />
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

