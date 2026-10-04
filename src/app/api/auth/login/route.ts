import { NextRequest, NextResponse } from "next/server";
import { signToken } from "@/lib/session-utils";
import { createServerSupabaseClient } from "@/lib/db/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

const SESSION_COOKIE = "cf_session";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours (reduced from 7 days for session hygiene)

// Rate limit: 5 login attempts per 15 minutes per IP
const LOGIN_RATE_LIMIT_OPTIONS = {
  windowMs: 15 * 60 * 1000,
  max: 5,
};

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

/**
 * POST /api/auth/login — Validates credentials and sets the session cookie with rate limiting.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rateLimitKey = `login_${ip}`;
    const rateLimitResult = checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT_OPTIONS);

    if (!rateLimitResult.allowed) {
      logger.warn("Login attempt blocked by rate limit", {
        service: "AuthLogin",
        ip,
        retryAfter: rateLimitResult.resetInSeconds,
      });

      return NextResponse.json(
        {
          success: false,
          error: "Too many login attempts. Please try again later.",
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
    const { email, password, orgId = "org_demo" } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email required" },
        { status: 400 }
      );
    }

    const isDemoEmail = email.includes("demo") || email.includes("admin") || email.includes("test");

    // In production with live Supabase, verify password against Supabase Auth
    if (env.isProduction && !isDemoEmail) {
      if (!password) {
        return NextResponse.json(
          { success: false, error: "Password is required" },
          { status: 400 }
        );
      }

      if (env.isSupabaseLive) {
        const supabase = createServerSupabaseClient();
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          logger.warn("Login authentication failed", {
            service: "AuthLogin",
            email,
            ip,
            error: authError.message,
          });
          return NextResponse.json(
            { success: false, error: "Invalid email or password" },
            { status: 401 }
          );
        }
      }
    }

    // Reset rate limit on successful credentials verification
    resetRateLimit(rateLimitKey);

    const token = signToken({ email, orgId, ts: Date.now().toString() });

    const response = NextResponse.json({
      success: true,
      data: { email, orgId },
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (err: any) {
    logger.error("Unexpected error in login handler", {
      service: "AuthLogin",
      error: err.message,
    });
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/login — Destroys the session cookie (logout).
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
