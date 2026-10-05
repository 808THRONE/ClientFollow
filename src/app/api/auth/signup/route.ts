import { NextRequest, NextResponse } from "next/server";
import { signToken, SESSION_COOKIE, getSessionCookieOptions } from "@/lib/session-utils";
import { createServerSupabaseClient } from "@/lib/db/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { SignupRequestSchema } from "@/lib/db/validators";

// Rate limit: 5 signup attempts per 15 minutes per IP
const SIGNUP_RATE_LIMIT_OPTIONS = {
  windowMs: 15 * 60 * 1000,
  max: 5,
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
 * POST /api/auth/signup — Registers a new user and organization.
 * Validates business name, industry, email format, and password length.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateLimitKey = `signup_${ip}`;
    const rateLimitResult = checkRateLimit(rateLimitKey, SIGNUP_RATE_LIMIT_OPTIONS);

    if (!rateLimitResult.allowed) {
      logger.warn("Signup attempt blocked by rate limit", {
        service: "AuthSignup",
        ip,
        retryAfter: rateLimitResult.resetInSeconds,
      });

      return NextResponse.json(
        {
          success: false,
          error: "Too many signup attempts. Please try again later.",
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
    const parsed = SignupRequestSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Validation failed";
      return NextResponse.json(
        { success: false, error: firstError },
        { status: 400 }
      );
    }

    const { businessName, industry, email, password } = parsed.data;

    if (env.isSupabaseLive) {
      const supabase = createServerSupabaseClient();
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${env.APP_URL.replace(/\/+$/, "")}/auth/callback`,
          data: {
            organization_name: businessName,
            industry,
          },
        },
      });

      if (authError || !authData.user) {
        logger.warn("Supabase user signup failed", {
          service: "AuthSignup",
          email,
          error: authError?.message,
        });
        return NextResponse.json(
          { success: false, error: authError?.message || "Failed to create account" },
          { status: 400 }
        );
      }

      // Create tenant organization record
      let orgId = `org_${crypto.randomUUID().slice(0, 8)}`;
      try {
        const { data: orgData, error: orgErr } = await supabase
          .from("organizations")
          .insert({
            name: businessName,
            industry,
          })
          .select("id")
          .single();

        if (!orgErr && orgData?.id) {
          orgId = String(orgData.id);
          await supabase.from("organization_members").insert({
            org_id: orgId,
            user_id: authData.user.id,
            role: "admin",
          });
        }
      } catch (e: unknown) {
        logger.warn("Non-fatal: could not create org DB row during signup", {
          service: "AuthSignup",
          error: e instanceof Error ? e.message : String(e),
        });
      }

      // If Supabase email confirmation is enabled, session will be null until verified
      if (!authData.session) {
        logger.info("Supabase user signed up, awaiting email verification", {
          service: "AuthSignup",
          email,
          userId: authData.user.id,
        });

        return NextResponse.json({
          success: true,
          requiresVerification: true,
          redirectUrl: `/verify-email?email=${encodeURIComponent(email)}`,
          data: { email, orgId, requiresVerification: true },
        });
      }

      const token = signToken({ email, orgId, ts: Date.now().toString() });
      const response = NextResponse.json({
        success: true,
        redirectUrl: "/onboarding",
        data: { email, orgId },
      });
      response.cookies.set(SESSION_COOKIE, token, getSessionCookieOptions());
      return response;
    }

    // In local development / sandbox mode: immediately establish session
    const sandboxOrgId = `org_${crypto.randomUUID().slice(0, 8)}`;
    const token = signToken({ email, orgId: sandboxOrgId, ts: Date.now().toString() });

    const response = NextResponse.json({
      success: true,
      redirectUrl: "/onboarding",
      isSandbox: true,
      data: { email, orgId: sandboxOrgId },
    });

    response.cookies.set(SESSION_COOKIE, token, getSessionCookieOptions());
    return response;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal signup error";
    logger.error("Unexpected error in signup handler", {
      service: "AuthSignup",
      error: errorMsg,
    });
    return NextResponse.json(
      { success: false, error: "Failed to process signup request. Please try again." },
      { status: 500 }
    );
  }
}
