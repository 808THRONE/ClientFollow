import { NextRequest, NextResponse } from "next/server";
import { createStripeCheckoutSession } from "@/lib/services/stripe.service";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { verifyToken, SESSION_COOKIE } from "@/lib/session-utils";
import { createServerSupabaseClient } from "@/lib/db/client";

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate caller via session cookie or Supabase session
    const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
    const sessionPayload = sessionToken ? verifyToken(sessionToken) : null;

    let isAuthenticated = !!sessionPayload;
    let authenticatedOrgId = sessionPayload?.orgId;

    if (!isAuthenticated && env.isSupabaseLive) {
      try {
        const supabase = createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          isAuthenticated = true;
        }
      } catch (err) {
        logger.warn("Supabase auth check failed in checkout endpoint", {
          service: "StripeCheckout",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: "Authentication required to initiate checkout" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const appUrl = env.APP_URL;

    if (!body.orgId) {
      return NextResponse.json(
        { success: false, error: "orgId is required for checkout" },
        { status: 400 }
      );
    }

    // 2. Enforce tenant boundary: caller cannot checkout for an organization other than their session
    if (authenticatedOrgId && authenticatedOrgId !== body.orgId) {
      logger.warn("Unauthorized cross-tenant checkout attempt blocked", {
        service: "StripeCheckout",
        sessionOrg: authenticatedOrgId,
        requestedOrg: body.orgId,
      });
      return NextResponse.json(
        { success: false, error: "Forbidden: session organization does not match requested organization" },
        { status: 403 }
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
