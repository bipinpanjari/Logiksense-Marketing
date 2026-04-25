"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getProfile, updateProfile } from "@/lib/account";
import { getAccessToken, getStoredWorkspace, setSession } from "@/lib/auth-storage";
import { useAuth } from "@/components/providers/auth-provider";
import { Callout } from "@/components/ui/callout";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/layout/page-shell";

export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getProfile();
        setFirstName(data.firstName || "");
        setLastName(data.lastName || "");
        setEmail(data.email || "");
      } catch (err: any) {
        setError(err?.message || "Failed to load profile");
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
      const data = await updateProfile({ firstName, lastName, email });
      const token = getAccessToken();
      if (token && user) {
        setSession({
          accessToken: token,
          user: {
            ...user,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            email: data.email,
          },
          workspace: getStoredWorkspace() || undefined,
        });
      }
      setMessage("Profile updated successfully.");
    } catch (err: any) {
      setError(err?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell narrow>
      <PageHeader title="Profile" description="Manage your account identity and sign-in email." />

      {error ? <Callout variant="destructive">{error}</Callout> : null}
      {message ? <Callout variant="success">{message}</Callout> : null}

      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>These details are used across your workspace and system notifications.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading profile...</p> : null}
          {!loading ? (
            <form className="space-y-5" onSubmit={onSave}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">First name</label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Your first name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Last name</label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Your last name" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
                <p className="text-xs text-muted-foreground">
                  Changing email updates your login identifier. If the new email is already taken, the save will be rejected.
                </p>
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
    </PageShell>
  );
}
