import { NextRequest, NextResponse } from "next/server";
import { processStripeWebhookEvent, verifyStripeWebhookSignature } from "@/lib/services/stripe.service";
import { createServerSupabaseClient } from "@/lib/db/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

    let event: any;
    if (signature && webhookSecret) {
      try {
        event = verifyStripeWebhookSignature(rawBody, signature, webhookSecret);
      } catch (err: any) {
        logger.warn("Stripe webhook signature verification failed", {
          service: "StripeWebhook",
          error: err.message,
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
      event = JSON.parse(rawBody || "{}");
    }

    // Process mapped event results
    const result = processStripeWebhookEvent(event);

    if (result.orgId) {
      if (env.isSupabaseLive) {
        try {
          const supabase = createServerSupabaseClient();
          const updateData: any = {
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
        } catch (err: any) {
          logger.error("Failed to update organization from Stripe webhook", {
            service: "StripeWebhook",
            orgId: result.orgId,
            error: err.message,
          });
          return NextResponse.json(
            { success: false, error: err.message },
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

      return NextResponse.json({
        success: true,
        updatedOrgId: result.orgId,
        status: result.subscriptionStatus,
      });
    }

    return NextResponse.json({ success: true, received: true, unhandledType: event?.type });
  } catch (error: any) {
    logger.error("Error processing Stripe webhook event", {
      service: "StripeWebhook",
      error: error.message,
    });
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
