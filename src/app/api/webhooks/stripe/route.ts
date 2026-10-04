import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { processStripeWebhookEvent, verifyStripeWebhookSignature } from "@/lib/services/stripe.service";
import { createServerSupabaseClient } from "@/lib/db/client";
import { idempotencyService } from "@/lib/services/idempotency.service";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;
    if (signature && webhookSecret) {
      try {
        event = verifyStripeWebhookSignature(rawBody, signature, webhookSecret);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Signature verification failed";
        logger.warn("Stripe webhook signature verification failed", {
          service: "StripeWebhook",
          error: errorMsg,
        });
        return NextResponse.json(
          { success: false, error: "Invalid webhook signature" },
          { status: 400 }
        );
      }
    } else if (env.isProduction) {
      logger.warn("Stripe webhook rejected: Missing signature or webhook secret in production", {
        service: "StripeWebhook",
      });
      return NextResponse.json(
        { success: false, error: "Missing signature or secret" },
        { status: 401 }
      );
    } else {
      // Development mock fallback
      event = JSON.parse(rawBody || "{}") as Stripe.Event;
    }

    // Process mapped event results
    const result = processStripeWebhookEvent(event);

    // Enforce idempotency: prevent processing duplicate events
    if (event?.id && (await idempotencyService.isEventProcessed(event.id))) {
      logger.info("Stripe webhook duplicate event ignored", {
        service: "StripeWebhook",
        eventId: event.id,
      });
      return NextResponse.json({ success: true, duplicate: true, received: true });
    }

    if (result.orgId) {
      if (env.isSupabaseLive) {
        try {
          const supabase = createServerSupabaseClient();
          const updateData: Record<string, unknown> = {
            subscription_status: result.subscriptionStatus,
            updated_at: new Date().toISOString(),
          };

          if (result.planTier) {
            updateData.plan_tier = result.planTier;
          }
          if (result.activeLeadsLimit !== undefined) {
            updateData.active_leads_limit = result.activeLeadsLimit;
          }
          if (result.stripeCustomerId) {
            updateData.stripe_customer_id = result.stripeCustomerId;
          }
          if (result.stripeSubscriptionId) {
            updateData.stripe_subscription_id = result.stripeSubscriptionId;
          }

          const { error: dbErr } = await supabase
            .from("organizations")
            .update(updateData)
            .eq("id", result.orgId);

          if (dbErr) {
            throw new Error(`Database error updating organization tier: ${dbErr.message}`);
          }
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : "Database update failed";
          logger.error("Failed to update organization from Stripe webhook", {
            service: "StripeWebhook",
            orgId: result.orgId,
            error: errorMsg,
          });
          return NextResponse.json(
            { success: false, error: errorMsg },
            { status: 500 }
          );
        }
      } else {
        logger.info("Stripe subscription update processed (mock mode)", {
          service: "StripeWebhook",
          orgId: result.orgId,
          status: result.subscriptionStatus,
        });
      }

      if (event?.id) {
        await idempotencyService.markEventProcessed(event.id, {
          type: event.type,
          orgId: result.orgId,
        });
      }

      return NextResponse.json({
        success: true,
        updatedOrgId: result.orgId,
        status: result.subscriptionStatus,
      });
    }

    if (event?.id) {
      await idempotencyService.markEventProcessed(event.id, { type: event.type });
    }

    return NextResponse.json({ success: true, received: true, unhandledType: event?.type });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal server error";
    logger.error("Error processing Stripe webhook event", {
      service: "StripeWebhook",
      error: errorMsg,
    });
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
