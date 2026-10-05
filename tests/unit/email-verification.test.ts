import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as resendVerificationPost } from "@/app/api/auth/resend-verification/route";
import { GET as authCallbackGet } from "@/app/auth/callback/route";
import { POST as signupPost } from "@/app/api/auth/signup/route";

describe("Email Verification & Callback Flows", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/auth/resend-verification", () => {
    it("rejects invalid or dummy emails with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: "a@a.com" }),
      });

      const res = await resendVerificationPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("dummy email");
    });

    it("simulates email dispatch in local sandbox mode", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: "doctor@apexsmiles.com" }),
      });

      const res = await resendVerificationPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.simulated).toBe(true);
      expect(json.message).toContain("Sandbox mode");
    });

    it("enforces rate limit after exceeding max attempts from same IP", async () => {
      const makeReq = () =>
        new NextRequest("http://localhost:3000/api/auth/resend-verification", {
          method: "POST",
          headers: { "x-forwarded-for": "198.51.100.42" },
          body: JSON.stringify({ email: "ratelimit@clinic.com" }),
        });

      // 3 attempts are allowed per 15min window
      await resendVerificationPost(makeReq());
      await resendVerificationPost(makeReq());
      await resendVerificationPost(makeReq());

      // 4th attempt should be blocked with 429
      const blockedRes = await resendVerificationPost(makeReq());
      expect(blockedRes.status).toBe(429);
      const json = await blockedRes.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("Too many resend attempts");
    });
  });

  describe("GET /auth/callback", () => {
    it("immediately passes through with verified session in sandbox mode", async () => {
      const req = new NextRequest(
        "http://localhost:3000/auth/callback?email=doctor@apexsmiles.com&next=/onboarding"
      );

      const res = await authCallbackGet(req);
      // Next.js redirect responds with 307
      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toContain("/onboarding");
      expect(location).toContain("verified=true");
      expect(res.cookies.get("cf_session")).toBeDefined();
    });

    it("falls back to default clinic email if email param is omitted in sandbox mode", async () => {
      const req = new NextRequest("http://localhost:3000/auth/callback");

      const res = await authCallbackGet(req);
      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toContain("/onboarding");
      expect(location).toContain("verified=true");
      expect(res.cookies.get("cf_session")).toBeDefined();
    });
  });

  describe("Live Supabase Email Confirmation Handling in POST /api/auth/signup", () => {
    it("routes user to /verify-email without session cookie when email confirmation is pending", async () => {
      const { env } = await import("@/lib/env");
      const clientModule = await import("@/lib/db/client");

      const origIsLive = env.isSupabaseLive;
      Object.defineProperty(env, "isSupabaseLive", { value: true, configurable: true });

      // Mock createServerSupabaseClient
      const mockSupabase = {
        auth: {
          signUp: vi.fn().mockResolvedValue({
            data: {
              user: { id: "user_test_uuid_123", email: "dr.smith@apexsmiles.com" },
              session: null, // Supabase returns null session when email confirmation is required!
            },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "org_live_123" }, error: null }),
            }),
          }),
        }),
      };

      const spy = vi.spyOn(clientModule, "createServerSupabaseClient").mockReturnValue(mockSupabase as any);

      try {
        const req = new NextRequest("http://localhost:3000/api/auth/signup", {
          method: "POST",
          headers: { "x-forwarded-for": "192.0.2.1" },
          body: JSON.stringify({
            businessName: "Smith Smiles",
            industry: "dentist",
            email: "dr.smith@apexsmiles.com",
            password: "superSecurePassword123!",
          }),
        });

        const res = await signupPost(req);
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.success).toBe(true);
        expect(json.requiresVerification).toBe(true);
        expect(json.redirectUrl).toBe("/verify-email?email=dr.smith%40apexsmiles.com");
        // Critical: Should NOT set session cookie before email verification!
        expect(res.cookies.get("cf_session")).toBeUndefined();
      } finally {
        spy.mockRestore();
        Object.defineProperty(env, "isSupabaseLive", { value: origIsLive, configurable: true });
      }
    });

    it("returns error 400 when Supabase signUp returns auth error", async () => {
      const { env } = await import("@/lib/env");
      const clientModule = await import("@/lib/db/client");

      const origIsLive = env.isSupabaseLive;
      Object.defineProperty(env, "isSupabaseLive", { value: true, configurable: true });

      const mockSupabase = {
        auth: {
          signUp: vi.fn().mockResolvedValue({
            data: { user: null, session: null },
            error: { message: "User already registered" },
          }),
        },
      };

      const spy = vi.spyOn(clientModule, "createServerSupabaseClient").mockReturnValue(mockSupabase as any);

      try {
        const req = new NextRequest("http://localhost:3000/api/auth/signup", {
          method: "POST",
          headers: { "x-forwarded-for": "192.0.2.2" },
          body: JSON.stringify({
            businessName: "Smith Smiles",
            industry: "dentist",
            email: "existing@apexsmiles.com",
            password: "superSecurePassword123!",
          }),
        });

        const res = await signupPost(req);
        expect(res.status).toBe(400);
        const json = await res.json();

        expect(json.success).toBe(false);
        expect(json.error).toContain("User already registered");
      } finally {
        spy.mockRestore();
        Object.defineProperty(env, "isSupabaseLive", { value: origIsLive, configurable: true });
      }
    });
  });
});
