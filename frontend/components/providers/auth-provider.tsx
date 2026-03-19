"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { API_URL } from "@/lib/config";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  getStoredWorkspace,
  setSession,
  type AuthUser,
  type AuthWorkspace,
} from "@/lib/auth-storage";
import { getValidAccessToken } from "@/lib/api-client";

interface AuthContextValue {
  user: AuthUser | null;
  workspace: AuthWorkspace | null;
  isAuthenticated: boolean;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PUBLIC_ROUTES = new Set(["/login", "/register"]);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspace, setWorkspace] = useState<AuthWorkspace | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      const optimisticAuth = Boolean(getAccessToken() || getRefreshToken());
      if (!optimisticAuth) {
        setLoading(false);
        setIsAuthenticated(false);
        if (!PUBLIC_ROUTES.has(pathname)) router.replace("/login");
        return;
      }

      try {
        const token = await getValidAccessToken();
        if (!token) throw new Error("No token");

        const res = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Session expired");

        const data = await res.json();
        const resolvedUser: AuthUser =
          data?.user || getStoredUser() || { id: "unknown", email: "unknown@local.dev", firstName: "User" };
        const resolvedWorkspace: AuthWorkspace | null =
          data?.workspace || getStoredWorkspace() || null;

        setSession({ accessToken: token, user: resolvedUser, workspace: resolvedWorkspace || undefined });
        setUser(resolvedUser);
        setWorkspace(resolvedWorkspace);
        setIsAuthenticated(true);
        if (PUBLIC_ROUTES.has(pathname)) router.replace("/dashboard");
      } catch {
        clearSession();
        setUser(null);
        setWorkspace(null);
        setIsAuthenticated(false);
        if (!PUBLIC_ROUTES.has(pathname)) router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [pathname, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      workspace,
      isAuthenticated,
      loading,
      logout: () => {
        clearSession();
        setUser(null);
        setWorkspace(null);
        setIsAuthenticated(false);
        router.replace("/login");
      },
    }),
    [user, workspace, isAuthenticated, loading, router]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

