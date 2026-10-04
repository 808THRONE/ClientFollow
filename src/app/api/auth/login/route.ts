import { NextRequest, NextResponse } from "next/server";
import { signToken, SESSION_COOKIE, getSessionCookieOptions } from "@/lib/session-utils";
import { createServerSupabaseClient } from "@/lib/db/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

// Rate limit: 5 login attempts per 15 minutes per IP
const LOGIN_RATE_LIMIT_OPTIONS = {
  windowMs: 15 * 60 * 1000,
  max: 5,
};

function getClientIp(req: NextRequest): string {
  // Prefer platform-verified IP headers that cannot be spoofed by downstream clients
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

    // In production, strictly require password for all emails without backdoor exceptions
    if (env.isProduction) {
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
      } else {
        // Fail closed in production if auth backend is not configured
        logger.error("Authentication backend unavailable in production", {
          service: "AuthLogin",
          email,
        });
        return NextResponse.json(
          { success: false, error: "Authentication service unavailable" },
          { status: 503 }
        );
      }
    } else {
      // In development / test environment: if Supabase is live and password provided, verify it
      if (env.isSupabaseLive && password) {
        const supabase = createServerSupabaseClient();
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
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

    response.cookies.set(SESSION_COOKIE, token, getSessionCookieOptions());

    return response;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal login error";
    logger.error("Unexpected error in login handler", {
      service: "AuthLogin",
      error: errorMsg,
    });
    return NextResponse.json(
      { success: false, error: env.isProduction ? "Authentication failed" : errorMsg },
      { status: 500 }
    );
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
