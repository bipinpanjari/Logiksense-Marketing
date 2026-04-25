"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { LandingMarketing } from "@/components/marketing/landing-marketing";

export function HomeGate() {
  const { loading, isAuthenticated } = useAuth();

  if (loading || isAuthenticated) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return <LandingMarketing />;
}
