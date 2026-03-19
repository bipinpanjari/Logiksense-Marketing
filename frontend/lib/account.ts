import { authedFetch } from "@/lib/api-client";

export interface ProfileResponse {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
}

export interface SettingsResponse {
  id: string;
  name: string;
  settings: Record<string, unknown> | null;
}

export async function getProfile() {
  const res = await authedFetch("/auth/profile", { method: "GET" });
  return (await res.json()) as ProfileResponse;
}

export async function updateProfile(payload: { firstName?: string; lastName?: string; email?: string }) {
  const res = await authedFetch("/auth/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return (await res.json()) as ProfileResponse;
}

export async function getSettings() {
  const res = await authedFetch("/auth/settings", { method: "GET" });
  return (await res.json()) as SettingsResponse;
}

export async function updateSettings(payload: {
  workspaceName?: string;
  timezone?: string;
  notifications?: {
    productUpdates?: boolean;
    campaignAlerts?: boolean;
    weeklyDigest?: boolean;
  };
}) {
  const res = await authedFetch("/auth/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return (await res.json()) as SettingsResponse;
}
