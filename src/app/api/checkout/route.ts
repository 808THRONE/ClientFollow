import { NextRequest, NextResponse } from "next/server";
import { createStripeCheckoutSession } from "@/lib/services/stripe.service";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const appUrl = env.APP_URL;

    if (!body.orgId) {
      return NextResponse.json(
        { success: false, error: "orgId is required for checkout" },
        { status: 400 }
      );
    }

    let session: { sessionId: string; url: string | null };
    try {
      session = await createStripeCheckoutSession({
        orgId: body.orgId,
        planTier: body.planTier || "growth",
        successUrl: `${appUrl}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${appUrl}/settings?billing=canceled`,
        customerEmail: body.email,
      });
    } catch (stripeErr: unknown) {
      const stripeMsg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
      if (env.isProduction) {
        logger.error("Failed to create live Stripe checkout session in production", {
          service: "StripeCheckout",
          orgId: body.orgId,
          error: stripeMsg,
        });
        return NextResponse.json(
          { success: false, error: `Checkout error: ${stripeMsg}` },
          { status: 500 }
        );
      }

      logger.warn("Providing test sandbox session in development", {
        service: "StripeCheckout",
        orgId: body.orgId,
        error: stripeMsg,
      });
      session = {
        sessionId: `cs_test_${Date.now()}`,
        url: `${appUrl}/settings?billing=success&session_id=cs_test_${Date.now()}`,
      };
    }

    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      url: session.url || `${appUrl}/settings?billing=success`,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal checkout error";
    logger.error("Unexpected checkout session error", {
      service: "StripeCheckout",
      error: errorMsg,
    });
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
