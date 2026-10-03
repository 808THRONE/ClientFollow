import { describe, it, expect } from "vitest";
import {
  generateGoogleAuthUrl,
  decodePubSubNotification,
  processGmailPushWebhook,
} from "@/lib/services/gmail.service";

describe("Google OAuth & Gmail Pub/Sub Integration", () => {
  it("generates correct Google OAuth consent URL with requested restricted scopes", () => {
    const authUrl = generateGoogleAuthUrl({
      clientId: "mock-google-client-id.apps.googleusercontent.com",
      redirectUri: "https://app.clientfollow.com/api/auth/gmail/callback",
      state: "org_12345",
    });

    expect(authUrl).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(authUrl).toContain("client_id=mock-google-client-id.apps.googleusercontent.com");
    expect(authUrl).toContain("gmail.send");
    expect(authUrl).toContain("gmail.metadata");
    expect(authUrl).toContain("gmail.modify");
    expect(authUrl).toContain("state=org_12345");
  });

  it("decodes Google Cloud Pub/Sub base64 payload into emailAddress and historyId", () => {
    const rawData = JSON.stringify({
      emailAddress: "dentist.clinic@gmail.com",
      historyId: "987654321",
    });
    const base64Data = Buffer.from(rawData).toString("base64");

    const decoded = decodePubSubNotification(base64Data);
    expect(decoded?.emailAddress).toBe("dentist.clinic@gmail.com");
    expect(decoded?.historyId).toBe("987654321");
  });

  it("returns null when base64 payload is invalid or empty", () => {
    const decoded = decodePubSubNotification("");
    expect(decoded).toBeNull();
  });

  it("processes incoming Pub/Sub envelope and creates Inngest sync event", () => {
    const rawData = JSON.stringify({
      emailAddress: "dentist.clinic@gmail.com",
      historyId: "987654321",
    });
    const base64Data = Buffer.from(rawData).toString("base64");

    const envelope = {
      message: {
        data: base64Data,
        messageId: "pubsub-msg-123",
        publishTime: "2026-09-27T17:00:00Z",
      },
      subscription: "projects/clientfollow-prod/subscriptions/gmail-inbox-watch",
    };

    const result = processGmailPushWebhook(envelope);
    expect(result).not.toBeNull();
    expect(result?.emailAddress).toBe("dentist.clinic@gmail.com");
    expect(result?.historyId).toBe("987654321");
    expect(result?.inngestEvent).toEqual({
      name: "app/gmail.history.received",
      data: {
        emailAddress: "dentist.clinic@gmail.com",
        historyId: "987654321",
      },
    });
  });

  it("returns null when Pub/Sub envelope is malformed or missing data", () => {
    expect(processGmailPushWebhook({})).toBeNull();
    expect(processGmailPushWebhook({ message: null })).toBeNull();
    expect(processGmailPushWebhook({ message: { data: "invalid-json-base64" } })).toBeNull();
  });
});

