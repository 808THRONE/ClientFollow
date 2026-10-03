import React from "react";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const metadata = {
  title: "Get Started — ClientFollow",
  description: "3-Step Onboarding and Past 7-Day Revenue Scanner",
};

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <OnboardingWizard />
    </main>
  );
}
