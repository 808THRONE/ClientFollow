import Stripe from "stripe";
import { TIER_CONFIGS } from "./usage.service";
import { env } from "@/lib/env";

export const STRIPE_TIER_PRICES: Record<string, string> = {
  starter: env.STRIPE_PRICE_STARTER,
  growth: env.STRIPE_PRICE_GROWTH,
  pro: env.STRIPE_PRICE_PRO,
};

export interface BuildCheckoutParams {
  orgId: string;
  planTier: "starter" | "growth" | "pro";
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

export interface StripeWebhookResult {
  orgId: string | null;
  subscriptionStatus: "active" | "canceled" | "past_due" | "unknown";
  planTier?: string;
  activeLeadsLimit?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

/**
 * Creates or retrieves a Stripe SDK client instance.
 */
export function getStripeClient(apiKey?: string): Stripe {
  const key = apiKey || env.STRIPE_SECRET_KEY;
  return new Stripe(key, {
    apiVersion: "2025-02-24.acacia" as any,
    typescript: true,
  });
}

/**
 * Builds standard parameters for creating a Stripe Checkout Session.
 */
export function buildCheckoutSessionOptions(params: BuildCheckoutParams): Stripe.Checkout.SessionCreateParams {
  const priceId = STRIPE_TIER_PRICES[params.planTier] || STRIPE_TIER_PRICES.starter;

  return {
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: params.customerEmail,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      org_id: params.orgId,
      plan_tier: params.planTier,
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  };
}

/**
 * Creates a live Stripe Checkout Session.
 */
export async function createStripeCheckoutSession(
  params: BuildCheckoutParams,
  stripeClient?: Stripe
): Promise<{ sessionId: string; url: string | null }> {
  const stripe = stripeClient || getStripeClient();
  const options = buildCheckoutSessionOptions(params);
  const session = await stripe.checkout.sessions.create(options);

  return {
    sessionId: session.id,
    url: session.url,
  };
}

/**
 * Verifies the incoming Stripe webhook cryptographic signature.
 */
export function verifyStripeWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
  stripeClient?: Stripe
): Stripe.Event {
  const stripe = stripeClient || getStripeClient();
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Stripe webhook verification failed: ${msg}`);
  }
}

/**
 * Parses Stripe webhook events and maps them to organization tier and status updates.
 */
export function processStripeWebhookEvent(
  event: Stripe.Event | { type?: string; data?: { object?: Record<string, unknown> } } | unknown
): StripeWebhookResult {
  const ev = event as { type?: string; data?: { object?: Record<string, unknown> } };
  const type = ev?.type;
  const obj = ev?.data?.object as Record<string, any> | undefined;

  switch (type) {
    case "checkout.session.completed": {
      const orgId = obj?.metadata?.org_id || null;
      const planTier = obj?.metadata?.plan_tier || "starter";
      const config = TIER_CONFIGS[planTier] || TIER_CONFIGS.starter;

      return {
        orgId,
        subscriptionStatus: "active",
        planTier,
        activeLeadsLimit: config.activeLeadsLimit,
        stripeCustomerId: obj?.customer,
        stripeSubscriptionId: obj?.subscription,
      };
    }

    case "customer.subscription.deleted": {
      const orgId = obj?.metadata?.org_id || null;
      return {
        orgId,
        subscriptionStatus: "canceled",
        activeLeadsLimit: 0,
      };
    }

    case "customer.subscription.updated": {
      const orgId = obj?.metadata?.org_id || null;
      const status = obj?.status === "active" ? "active" : "past_due";
      const planTier = obj?.metadata?.plan_tier || "starter";
      const config = TIER_CONFIGS[planTier] || TIER_CONFIGS.starter;

      return {
        orgId,
        subscriptionStatus: status,
        planTier,
        activeLeadsLimit: config.activeLeadsLimit,
      };
    }

    default:
      return {
        orgId: null,
        subscriptionStatus: "unknown",
      };
  }
}
