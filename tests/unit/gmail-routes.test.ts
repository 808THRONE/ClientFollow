import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as handleGmailAuth } from "@/app/api/auth/gmail/route";
import { POST as handleGmailWebhook } from "@/app/api/webhooks/gmail/route";
import { inngest } from "@/inngest/client";

vi.mock("@/inngest/client", () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ["mock-event-id"] }),
  },
}));

describe("Gmail OAuth and Webhook Route Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/auth/gmail", () => {
    it("returns JSON OAuth URL when format=json is specified", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/gmail?format=json&org_id=org_123");
      const res = await handleGmailAuth(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.url).toContain("accounts.google.com/o/oauth2/v2/auth");
      expect(data.url).toContain("state=org_123");
    });

    it("redirects to Google OAuth consent screen by default", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/gmail?org_id=org_123");
      const res = await handleGmailAuth(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("accounts.google.com/o/oauth2/v2/auth");
    });

    it("redirects to onboarding when code is present in callback", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/gmail?code=auth_code_xyz&state=org_123");
      const res = await handleGmailAuth(req);

      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toContain("/onboarding");
      expect(location).toContain("connected=gmail");
      expect(location).toContain("org_id=org_123");
    });
  });

  describe("POST /api/webhooks/gmail", () => {
    it("handles valid Pub/Sub push notification and emits inngest event", async () => {
      const rawData = JSON.stringify({
        emailAddress: "lawyer.smith@example.com",
        historyId: "12345678",
      });
      const base64Data = Buffer.from(rawData).toString("base64");

      const body = {
        message: {
          data: base64Data,
          messageId: "msg_pubsub_1",
          publishTime: "2026-09-27T17:00:00Z",
        },
        subscription: "projects/clientfollow-prod/subscriptions/gmail-inbox-watch",
      };

      const req = new NextRequest("http://localhost:3000/api/webhooks/gmail", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });

      const res = await handleGmailWebhook(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.emailAddress).toBe("lawyer.smith@example.com");
      expect(json.historyId).toBe("12345678");

      expect(inngest.send).toHaveBeenCalledWith({
        name: "app/gmail.history.received",
        data: {
          emailAddress: "lawyer.smith@example.com",
          historyId: "12345678",
        },
      });
    });

    it("returns 400 when Pub/Sub message data is invalid or missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/webhooks/gmail", {
        method: "POST",
        body: JSON.stringify({ message: null }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await handleGmailWebhook(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });
  });
});
