import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateBusinessEmail } from "@/lib/db/validators";

// Rate limit: 3 resend attempts per 15 minutes per IP
const RESEND_RATE_LIMIT_OPTIONS = {
  windowMs: 15 * 60 * 1000,
  max: 3,
};

function getClientIp(req: NextRequest): string {
  const vercelIp = req.headers.get("x-vercel-ip");
  if (vercelIp?.trim()) return vercelIp.trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "127.0.0.1";
}

/**
 * POST /api/auth/resend-verification — Requests a new email verification link.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateLimitKey = `resend_${ip}`;
    const rateLimitResult = checkRateLimit(rateLimitKey, RESEND_RATE_LIMIT_OPTIONS);

    if (!rateLimitResult.allowed) {
      logger.warn("Resend verification blocked by rate limit", {
        service: "AuthResend",
        ip,
        retryAfter: rateLimitResult.resetInSeconds,
      });

      return NextResponse.json(
        {
          success: false,
          error: "Too many resend attempts. Please wait a few minutes before trying again.",
          retryAfter: rateLimitResult.resetInSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": rateLimitResult.resetInSeconds.toString(),
          },
        }
      );
    }

    const body = await req.json();
    const { email } = body;

    const emailCheck = validateBusinessEmail(email);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { success: false, error: emailCheck.error || "Valid email required" },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (env.isSupabaseLive) {
      const supabase = createServerSupabaseClient();
      const redirectUrl = `${env.APP_URL.replace(/\/+$/, "")}/auth/callback`;

      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: trimmedEmail,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (resendError) {
        logger.warn("Supabase resend verification failed", {
          service: "AuthResend",
          email: trimmedEmail,
          error: resendError.message,
        });

        // Fail gracefully to prevent user enumeration attacks
        return NextResponse.json({
          success: true,
          message: "If an account exists with this email, a verification link has been sent.",
        });
      }

      logger.info("Resent verification email via Supabase", {
        service: "AuthResend",
        email: trimmedEmail,
      });

      return NextResponse.json({
        success: true,
        message: "A fresh verification link has been sent to your email.",
      });
    }

    // Local sandbox mode
    logger.info("Simulated verification email resend in sandbox mode", {
      service: "AuthResend",
      email: trimmedEmail,
    });

    return NextResponse.json({
      success: true,
      simulated: true,
      message: "Sandbox mode: Verification email simulated. You can proceed directly to onboarding.",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal resend error";
    logger.error("Unexpected error in resend verification handler", {
      service: "AuthResend",
      error: errorMsg,
    });

    return NextResponse.json(
      { success: false, error: "Failed to send verification email. Please try again later." },
      { status: 500 }
    );
  }
}
