import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleAuthCode } from "@/lib/services/gmail.service";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Dedicated Google OAuth2 Callback Route.
 * Receives the authorization code from Google, exchanges it for access and refresh tokens,
 * and redirects the user back to the application dashboard or settings.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state") || "";
  const error = searchParams.get("error");

  const baseUrl = request.nextUrl.origin;
  const returnTarget = state.includes("onboarding") ? "/onboarding" : "/settings";

  if (error) {
    return NextResponse.redirect(
      new URL(`${returnTarget}?error=${encodeURIComponent(error)}`, baseUrl)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(`${returnTarget}?error=missing_code`, baseUrl)
    );
  }

  const clientId =
    env.GOOGLE_CLIENT_ID || "mock-google-client-id.apps.googleusercontent.com";
  const clientSecret = env.GOOGLE_CLIENT_SECRET || "mock-google-client-secret";
  const redirectUri =
    env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/auth/gmail/callback`;

  try {
    await exchangeGoogleAuthCode(
      code,
      clientId,
      clientSecret,
      redirectUri
    );

    return NextResponse.redirect(
      new URL(`${returnTarget}?connected=gmail`, baseUrl)
    );
  } catch (err: any) {
    logger.error("Failed to exchange code for tokens", {
      service: "GmailCallback",
      error: err.message,
    });

    // Dev/Sandbox simulated success only if mock code was explicitly supplied
    if (!env.isProduction && code.includes("mock")) {
      return NextResponse.redirect(
        new URL(`${returnTarget}?connected=gmail`, baseUrl)
      );
    }

    return NextResponse.redirect(
      new URL(`${returnTarget}?error=exchange_failed`, baseUrl)
    );
  }
}
