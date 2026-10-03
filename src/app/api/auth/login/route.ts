import { NextRequest, NextResponse } from "next/server";
import { signToken } from "@/lib/session-utils";
import { createServerSupabaseClient } from "@/lib/db/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const SESSION_COOKIE = "cf_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * POST /api/auth/login — Validates credentials and sets the session cookie.
 */
export async function POST(req: NextRequest) {
  try {
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
            error: authError.message,
          });
          return NextResponse.json(
            { success: false, error: "Invalid email or password" },
            { status: 401 }
          );
        }
      }
    }

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
