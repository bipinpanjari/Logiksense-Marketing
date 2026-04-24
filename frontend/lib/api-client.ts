import { API_URL } from "@/lib/config";
import { clearSession, getAccessToken, getRefreshToken, setSession } from "@/lib/auth-storage";

export function apiUrl(path: string): string {
  const base = API_URL.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (base.endsWith("/api")) {
    if (p === "/api" || p === "/api/") {
      return base;
    }
    if (p.startsWith("/api/") || p.startsWith("/api?")) {
      return base + p.slice(4);
    }
  }
  return base + p;
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const response = await fetch(apiUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearSession();
    return null;
  }

  const data = await response.json();
  if (!data?.accessToken) {
    clearSession();
    return null;
  }

  setSession({ accessToken: data.accessToken, refreshToken });
  return data.accessToken;
}

export async function getValidAccessToken(): Promise<string | null> {
  const token = getAccessToken();
  if (token) return token;
  return refreshAccessToken();
}

export async function authedFetch(path: string, init?: RequestInit) {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    let message = raw || `Request failed (${response.status})`;
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") {
        message = (parsed.message as string) || (parsed.error as string) || message;
      }
    } catch {
      // ignore parse errors; keep raw text
    }
    if (response.status === 401) {
      clearSession();
    }
    throw new Error(message);
  }

  return response;
}

