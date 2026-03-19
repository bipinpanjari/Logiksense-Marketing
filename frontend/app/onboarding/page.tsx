"use client";

import dynamic from "next/dynamic";

const LegacyOnboarding = dynamic(() => import("@/src/pages/Registration"), { ssr: false });

export default function OnboardingPage() {
  return <LegacyOnboarding />;
}
