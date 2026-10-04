import { describe, it, expect } from "vitest";
import {
  buildCheckoutSessionOptions,
  processStripeWebhookEvent,
  STRIPE_TIER_PRICES,
} from "@/lib/services/stripe.service";

describe("Stripe Billing & Subscription Webhook Engine", () => {
  it("builds correct Checkout Session parameters for Growth plan ($49/mo)", () => {
    const options = buildCheckoutSessionOptions({
      orgId: "org_growth_123",
      planTier: "growth",
      successUrl: "https://app.clientfollow.com/dashboard?billing=success",
      cancelUrl: "https://app.clientfollow.com/pricing",
      customerEmail: "dr.smith@apex.com",
    });

    expect(options.mode).toBe("subscription");
    expect(options.line_items?.[0]?.price).toBe(STRIPE_TIER_PRICES.growth);
    expect(options.metadata?.org_id).toBe("org_growth_123");
    expect(options.customer_email).toBe("dr.smith@apex.com");
  });

  it("processes checkout.session.completed and returns updated organization state", () => {
    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_stripe_123",
          subscription: "sub_stripe_abc",
          metadata: {
            org_id: "org_growth_123",
            plan_tier: "growth",
          },
        },
      },
    };

    const update = processStripeWebhookEvent(event);
    expect(update.orgId).toBe("org_growth_123");
    expect(update.subscriptionStatus).toBe("active");
    expect(update.planTier).toBe("growth");
    expect(update.activeLeadsLimit).toBe(100);
  });

  it("trusts the line-item price over caller-supplied metadata.plan_tier", () => {
    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_stripe_123",
          subscription: "sub_stripe_abc",
          line_items: [
            {
              price: {
                id: STRIPE_TIER_PRICES.starter,
              },
            },
          ],
          metadata: {
            org_id: "org_growth_123",
            plan_tier: "pro",
          },
        },
      },
    };

    const update = processStripeWebhookEvent(event);
    expect(update.planTier).toBe("starter");
    expect(update.activeLeadsLimit).toBe(30);
  });

  it("falls back to metadata tier when the price id is unknown", () => {
    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_stripe_abc",
          status: "active",
          line_items: [{ price: { id: "price_unknown_x99" } }],
          metadata: {
            org_id: "org_growth_123",
            plan_tier: "growth",
          },
        },
      },
    };

    const update = processStripeWebhookEvent(event);
    expect(update.planTier).toBe("growth");
  });

  it("processes customer.subscription.deleted and reverts to canceled status", () => {
    const event = {
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_stripe_abc",
          metadata: {
            org_id: "org_growth_123",
          },
        },
      },
    };

    const update = processStripeWebhookEvent(event);
    expect(update.orgId).toBe("org_growth_123");
    expect(update.subscriptionStatus).toBe("canceled");
  });
});
