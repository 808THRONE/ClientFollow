import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { signToken, SESSION_COOKIE, getSessionCookieOptions } from "@/lib/session-utils";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * GET /auth/callback — Exchanges Supabase verification code / OTP token for a session.
 * Triggered when a user clicks the verification link in their email.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = requestUrl.searchParams.get("next") || "/onboarding";

  // If in sandbox mode without live Supabase: allow immediate verification pass-through
  if (!env.isSupabaseLive) {
    const email = requestUrl.searchParams.get("email") || "doctor@apexsmiles.com";
    const sandboxOrgId = `org_${crypto.randomUUID().slice(0, 8)}`;
    const token = signToken({ email, orgId: sandboxOrgId, ts: Date.now().toString() });

    const redirectUrl = new URL(next, requestUrl.origin);
    redirectUrl.searchParams.set("verified", "true");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(SESSION_COOKIE, token, getSessionCookieOptions());
    return response;
  }

  // Live Supabase flow
  const cookieStore = request.cookies;
  const response = NextResponse.redirect(new URL(next, requestUrl.origin));

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
        });
      },
    },
  });

  try {
    let verifiedUser = null;

    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      verifiedUser = data.user;
    } else if (tokenHash && type) {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) throw error;
      verifiedUser = data.user;
    }

    if (!verifiedUser || !verifiedUser.email) {
      logger.warn("Verification callback called without valid user", { service: "AuthCallback" });
      const errorUrl = new URL("/login", requestUrl.origin);
      errorUrl.searchParams.set("error", "Email verification link has expired or is invalid.");
      return NextResponse.redirect(errorUrl);
    }

    // Resolve or provision the organization for the verified user
    let orgId = `org_${crypto.randomUUID().slice(0, 8)}`;
    const { data: member } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", verifiedUser.id)
      .limit(1)
      .single();

    if (member?.org_id) {
      orgId = String(member.org_id);
    } else {
      // If organization row wasn't created yet during signup, create it now
      const orgName = (verifiedUser.user_metadata?.organization_name as string) || "My Clinic";
      const industry = (verifiedUser.user_metadata?.industry as string) || "dentist";

      const { data: newOrg } = await supabase
        .from("organizations")
        .insert({ name: orgName, industry })
        .select("id")
        .single();

      if (newOrg?.id) {
        orgId = String(newOrg.id);
        await supabase.from("organization_members").insert({
          org_id: orgId,
          user_id: verifiedUser.id,
          role: "admin",
        });
      }
    }

    // Sign the ClientFollow session token and attach session cookie
    const token = signToken({
      email: verifiedUser.email,
      orgId,
      ts: Date.now().toString(),
    });

    response.cookies.set(SESSION_COOKIE, token, getSessionCookieOptions());

    const successUrl = new URL(next, requestUrl.origin);
    successUrl.searchParams.set("verified", "true");
    return NextResponse.redirect(successUrl);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Verification failed";
    logger.error("Error during email verification token exchange", {
      service: "AuthCallback",
      error: msg,
    });

    const errorUrl = new URL("/login", requestUrl.origin);
    errorUrl.searchParams.set("error", "Verification link has expired or was already used.");
    return NextResponse.redirect(errorUrl);
  }
}
