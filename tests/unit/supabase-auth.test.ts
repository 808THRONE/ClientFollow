import { describe, it, expect, vi } from "vitest";
import { isPublicPath, resolveTenantSession } from "@/lib/supabase/auth-utils";

describe("Supabase Auth & Tenant Utilities", () => {
  it("identifies public vs protected routes correctly", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/api/inngest")).toBe(true);
    expect(isPublicPath("/api/webhooks/stripe")).toBe(true);
    expect(isPublicPath("/api/webhooks/whatsapp")).toBe(true);
    expect(isPublicPath("/icon.svg")).toBe(true);

    expect(isPublicPath("/approvals")).toBe(false);
    expect(isPublicPath("/playbooks")).toBe(false);
    expect(isPublicPath("/settings")).toBe(false);
    expect(isPublicPath("/onboarding")).toBe(false);
  });

  it("resolves tenant session from user metadata or header fallback", () => {
    const mockUser = {
      id: "usr_abc123",
      email: "dentist@brightsmile.com",
      user_metadata: {
        org_id: "org_dentist_001",
        role: "admin",
      },
    };

    const session = resolveTenantSession(mockUser, null);
    expect(session.orgId).toBe("org_dentist_001");
    expect(session.userId).toBe("usr_abc123");
    expect(session.role).toBe("admin");
  });

  it("handles fallback to default guest org when user has no explicit tenant metadata", () => {
    const mockUser = {
      id: "usr_guest",
      email: "guest@example.com",
      user_metadata: {},
    };

    const session = resolveTenantSession(mockUser, "org_fallback_header");
    expect(session.orgId).toBe("org_fallback_header");
    expect(session.userId).toBe("usr_guest");
  });
});
