import Stripe from "stripe";
import { TIER_CONFIGS } from "./usage.service";
import { env } from "@/lib/env";
import { CircuitBreaker } from "@/lib/circuit-breaker";
import { isFeatureEnabled } from "@/lib/feature-flags";

export const stripeCircuitBreaker = new CircuitBreaker({
  name: "StripeBillingAPI",
  failureThreshold: 3,
  recoveryTimeoutMs: 30_000,
  timeoutMs: 10_000,
});

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

  const executeCall = async () => {
    const session = await stripe.checkout.sessions.create(options);
    return {
      sessionId: session.id,
      url: session.url,
    };
  };

  if (isFeatureEnabled("circuit_breaker_enabled")) {
    return stripeCircuitBreaker.execute(executeCall);
  }
  return executeCall();
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
/**
 * Derives the plan tier from the event's line-item price when available.
 * The price id is authoritative (billed by Stripe); caller-supplied metadata
 * is only a fallback.
 */
function derivePlanTierFromLineItems(obj: Record<string, unknown> | null | undefined): string | undefined {
  const lineItems = obj?.line_items;
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return undefined;
  }

  const firstItem = lineItems[0] as { price?: { id?: string } | string } | null;
  const price = firstItem?.price;
  const priceId = typeof price === "string" ? price : price?.id;
  if (!priceId) {
    return undefined;
  }

  const entry = Object.entries(STRIPE_TIER_PRICES).find(([, knownPriceId]) => knownPriceId === priceId);
  return entry?.[0];
}

export function processStripeWebhookEvent(
  event: Stripe.Event | { type?: string; data?: { object?: Record<string, unknown> } } | unknown
): StripeWebhookResult {
  const ev = event as { type?: string; data?: { object?: Record<string, unknown> } };
  const type = ev?.type;
  const obj = ev?.data?.object;
  const metadata = (obj?.metadata && typeof obj.metadata === "object" ? obj.metadata : {}) as Record<string, string>;

  switch (type) {
    case "checkout.session.completed": {
      const orgId = metadata.org_id || null;
      const planTier = derivePlanTierFromLineItems(obj) || metadata.plan_tier || "starter";
      const config = TIER_CONFIGS[planTier] || TIER_CONFIGS.starter;

      return {
        orgId,
        subscriptionStatus: "active",
        planTier,
        activeLeadsLimit: config.activeLeadsLimit,
        stripeCustomerId: typeof obj?.customer === "string" ? obj.customer : undefined,
        stripeSubscriptionId: typeof obj?.subscription === "string" ? obj.subscription : undefined,
      };
    }

    case "customer.subscription.deleted": {
      const orgId = metadata.org_id || null;
      return {
        orgId,
        subscriptionStatus: "canceled",
        activeLeadsLimit: 0,
      };
    }

    case "customer.subscription.updated": {
      const orgId = metadata.org_id || null;
      const status = obj?.status === "active" ? "active" : "past_due";
      const planTier = derivePlanTierFromLineItems(obj) || metadata.plan_tier || "starter";
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
