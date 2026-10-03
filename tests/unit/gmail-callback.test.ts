import { describe, it, expect, vi } from "vitest";
import { GET } from "@/app/api/auth/gmail/callback/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/services/gmail.service", () => ({
  exchangeGoogleAuthCode: vi.fn().mockImplementation(async (code: string) => {
    if (code === "invalid_code") {
      throw new Error("Invalid OAuth code");
    }
    return {
      accessToken: "ya29.mock_access_token",
      refreshToken: "1//mock_refresh_token",
      expiresIn: 3600,
    };
  }),
}));

describe("Gmail OAuth Callback Route", () => {
  it("redirects with error parameter if code is missing or user denied access", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/gmail/callback?error=access_denied");
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("Location");
    expect(location).toContain("error=access_denied");
  });

  it("exchanges valid code for tokens and redirects to settings with success", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/gmail/callback?code=valid_test_code&state=org_demo");
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("Location");
    expect(location).toContain("/settings?connected=gmail");
  });

  it("handles token exchange error gracefully and redirects with error", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/gmail/callback?code=invalid_code");
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("Location");
    expect(location).toContain("error=exchange_failed");
  });
});
