import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  exchangeGoogleAuthCode,
  refreshGoogleAccessToken,
  sendGmailMessage,
} from "@/lib/services/gmail.service";
import { ChannelDispatcherService } from "@/lib/services/channel-dispatcher.service";

describe("Production Communication Gateways (Gmail & WhatsApp)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exchanges Google OAuth authorization code for tokens", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "ya29.test_access_token",
        refresh_token: "1//04test_refresh_token",
        expires_in: 3600,
      }),
    } as any);

    const tokens = await exchangeGoogleAuthCode(
      "sample_auth_code_123",
      "google_client_id",
      "google_client_secret",
      "https://clientfollow.com/api/auth/gmail/callback"
    );

    expect(tokens.accessToken).toBe("ya29.test_access_token");
    expect(tokens.refreshToken).toBe("1//04test_refresh_token");
    expect(tokens.expiresIn).toBe(3600);
  });

  it("refreshes expired Google access token using refresh token", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "ya29.refreshed_access_token",
        expires_in: 3600,
      }),
    } as any);

    const result = await refreshGoogleAccessToken(
      "1//04test_refresh_token",
      "google_client_id",
      "google_client_secret"
    );

    expect(result.accessToken).toBe("ya29.refreshed_access_token");
  });

  it("sends live Gmail message via Google REST API", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "msg_gmail_999",
        threadId: "th_gmail_888",
      }),
    } as any);

    const result = await sendGmailMessage("ya29.token", {
      to: "patient@example.com",
      subject: "Follow-up regarding your dental visit",
      body: "Hi Sarah, we wanted to check in on how your tooth is feeling.",
    });

    expect(result.messageId).toBe("msg_gmail_999");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer ya29.token",
        }),
      })
    );
  });

  it("dispatches WhatsApp Cloud API message with Graph API payload", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        messaging_product: "whatsapp",
        contacts: [{ input: "+15551234567", wa_id: "15551234567" }],
        messages: [{ id: "wamid.HBgLMTU1NTEyMzQ1NjcVAgASGB..." }],
      }),
    } as any);

    const result = await ChannelDispatcherService.dispatchWhatsApp({
      apiToken: "wa_token_secret",
      phoneNumberId: "phone_num_999",
      payload: {
        messaging_product: "whatsapp",
        to: "+15551234567",
        type: "text",
        text: { body: "Hello from ClientFollow!" },
      },
    });

    expect(result.messageId).toBe("wamid.HBgLMTU1NTEyMzQ1NjcVAgASGB...");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://graph.facebook.com/v21.0/phone_num_999/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer wa_token_secret",
        }),
      })
    );
  });
});
