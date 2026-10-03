import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createStripeCheckoutSession,
  verifyStripeWebhookSignature,
} from "@/lib/services/stripe.service";

describe("Live Stripe SDK Billing Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a live Stripe Checkout Session with metadata and URLs", async () => {
    const mockStripeInstance: any = {
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({
            id: "cs_test_12345",
            url: "https://checkout.stripe.com/c/pay/cs_test_12345",
          }),
        },
      },
    };

    const session = await createStripeCheckoutSession(
      {
        orgId: "org_bright_smile",
        planTier: "growth",
        successUrl: "https://clientfollow.com/settings?session_id={CHECKOUT_SESSION_ID}",
        cancelUrl: "https://clientfollow.com/settings",
        customerEmail: "drfinch@brightsmile.com",
      },
      mockStripeInstance
    );

    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer_email: "drfinch@brightsmile.com",
        metadata: {
          org_id: "org_bright_smile",
          plan_tier: "growth",
        },
      })
    );
    expect(session.sessionId).toBe("cs_test_12345");
    expect(session.url).toBe("https://checkout.stripe.com/c/pay/cs_test_12345");
  });

  it("verifies incoming Stripe webhook signature with stripe SDK", () => {
    const mockEvent = {
      id: "evt_123",
      type: "checkout.session.completed",
      data: { object: { id: "cs_123" } },
    };

    const mockStripeInstance: any = {
      webhooks: {
        constructEvent: vi.fn().mockReturnValue(mockEvent),
      },
    };

    const verified = verifyStripeWebhookSignature(
      JSON.stringify(mockEvent),
      "t=123,v1=sig_hash",
      "whsec_test_secret",
      mockStripeInstance
    );

    expect(mockStripeInstance.webhooks.constructEvent).toHaveBeenCalledWith(
      JSON.stringify(mockEvent),
      "t=123,v1=sig_hash",
      "whsec_test_secret"
    );
    expect(verified.id).toBe("evt_123");
  });

  it("throws clear error when Stripe webhook signature fails", () => {
    const mockStripeInstance: any = {
      webhooks: {
        constructEvent: vi.fn().mockImplementation(() => {
          throw new Error("No signatures found matching the expected signature for payload");
        }),
      },
    };

    expect(() =>
      verifyStripeWebhookSignature(
        "tampered_body",
        "invalid_sig",
        "whsec_secret",
        mockStripeInstance
      )
    ).toThrow("Stripe webhook verification failed");
  });
});
