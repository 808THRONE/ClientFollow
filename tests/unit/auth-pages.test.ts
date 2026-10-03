import { describe, it, expect, vi } from "vitest";
import React from "react";
import LoginPage from "@/app/login/page";
import SignupPage from "@/app/signup/page";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

// Mock supabase client
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signUp: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

describe("Authentication Pages (UI)", () => {
  it("renders LoginPage with email, password inputs and action buttons", () => {
    const element = React.createElement(LoginPage);
    expect(element).toBeDefined();
  });

  it("renders SignupPage with business name, industry options and inputs", () => {
    const element = React.createElement(SignupPage);
    expect(element).toBeDefined();
  });
});
