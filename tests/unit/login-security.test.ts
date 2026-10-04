import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as checkoutPost } from "@/app/api/checkout/route";
import { signToken, SESSION_COOKIE } from "@/lib/session-utils";

describe("Security Regression: B10 & B13 Hardening", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Login Backdoor Prevention (B10 / S8)", () => {
    it("rejects login attempt if email is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });

      const res = await loginPost(req);
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error).toBe("Email required");
    });

    it("requires password when env.isProduction is true even for admin or demo emails", async () => {
      // Mock env.isProduction to true
      const { env } = await import("@/lib/env");
      const originalIsProd = env.isProduction;
      Object.defineProperty(env, "isProduction", { value: true, configurable: true });

      try {
        const req = new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: "admin@attacker.com" }),
          headers: { "Content-Type": "application/json" },
        });

        const res = await loginPost(req);
        const json = await res.json();
        expect(res.status).toBe(400);
        expect(json.error).toBe("Password is required");
      } finally {
        Object.defineProperty(env, "isProduction", { value: originalIsProd, configurable: true });
      }
    });

    it("fails closed with 503 if in production and Supabase backend is not live", async () => {
      const { env } = await import("@/lib/env");
      const originalIsProd = env.isProduction;
      const originalIsLive = env.isSupabaseLive;
      Object.defineProperty(env, "isProduction", { value: true, configurable: true });
      Object.defineProperty(env, "isSupabaseLive", { value: false, configurable: true });

      try {
        const req = new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: "doctor@apexsmiles.com", password: "some_password" }),
          headers: { "Content-Type": "application/json" },
        });

        const res = await loginPost(req);
        const json = await res.json();
        expect(res.status).toBe(503);
        expect(json.error).toBe("Authentication service unavailable");
      } finally {
        Object.defineProperty(env, "isProduction", { value: originalIsProd, configurable: true });
        Object.defineProperty(env, "isSupabaseLive", { value: originalIsLive, configurable: true });
      }
    });
  });

  describe("Checkout Authorization & Boundary Enforcement (B13 / S13)", () => {
    it("rejects unauthenticated requests without session cookie", async () => {
      const req = new NextRequest("http://localhost:3000/api/checkout", {
        method: "POST",
        body: JSON.stringify({ orgId: "org_target_clinic" }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await checkoutPost(req);
      const json = await res.json();
      expect(res.status).toBe(401);
      expect(json.error).toContain("Authentication required");
    });

    it("rejects cross-tenant checkout when session org does not match body org", async () => {
      const validToken = signToken({ email: "user@demo.com", orgId: "org_user_own" });
      const req = new NextRequest("http://localhost:3000/api/checkout", {
        method: "POST",
        body: JSON.stringify({ orgId: "org_other_victim" }),
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE}=${validToken}`,
        },
      });

      const res = await checkoutPost(req);
      const json = await res.json();
      expect(res.status).toBe(403);
      expect(json.error).toContain("Forbidden: session organization does not match");
    });

    it("permits authorized checkout when session org matches requested org", async () => {
      const validToken = signToken({ email: "user@demo.com", orgId: "org_apex_dental" });
      const req = new NextRequest("http://localhost:3000/api/checkout", {
        method: "POST",
        body: JSON.stringify({ orgId: "org_apex_dental", planTier: "starter" }),
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE}=${validToken}`,
        },
      });

      const res = await checkoutPost(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.sessionId).toBeDefined();
    });
  });
});
