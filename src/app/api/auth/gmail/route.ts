import { NextRequest, NextResponse } from "next/server";
import { generateGoogleAuthUrl, exchangeGoogleAuthCode } from "@/lib/services/gmail.service";
import { CryptoService } from "@/lib/services/crypto.service";
import { createServerSupabaseClient } from "@/lib/db/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Google OAuth Initiation and Callback Handler with FIPS 140-3 KMS Token Encryption
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state") || searchParams.get("org_id") || "default_org";
  const format = searchParams.get("format");

  // Callback phase: User was redirected back from Google with authorization code
  if (code) {
    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;
    const redirectUri =
      env.GOOGLE_REDIRECT_URI || new URL("/api/auth/gmail", req.url).toString();

    if (clientId && clientSecret && !clientId.includes("mock")) {
      try {
        const tokens = await exchangeGoogleAuthCode(code, clientId, clientSecret, redirectUri);
        const cryptoService = new CryptoService();
        const encrypted = await cryptoService.encrypt(tokens.accessToken, state);

        if (env.isSupabaseLive) {
          const supabase = createServerSupabaseClient();
          await supabase.from("channel_integrations").upsert({
            org_id: state,
            channel_type: "gmail",
            account_identifier: `gmail_account_${state}`,
            encrypted_access_token: encrypted.encryptedData,
            token_iv: encrypted.iv,
            token_auth_tag: encrypted.authTag,
            kms_key_id: encrypted.kmsKeyId,
            status: "active",
            last_synced_at: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        logger.warn("Gmail Auth Callback token exchange warning", {
          service: "GmailAuth",
          error: err?.message,
        });
      }
    }

    const returnUrl = new URL("/onboarding", req.url);
    returnUrl.searchParams.set("connected", "gmail");
    returnUrl.searchParams.set("org_id", state);
    return NextResponse.redirect(returnUrl);
  }

  // Initiation phase: Generate Google OAuth Consent URL
  const clientId =
    env.GOOGLE_CLIENT_ID || "mock-google-client-id.apps.googleusercontent.com";
  const redirectUri =
    env.GOOGLE_REDIRECT_URI || new URL("/api/auth/gmail", req.url).toString();

  const authUrl = generateGoogleAuthUrl({
    clientId,
    redirectUri,
    state,
  });

  if (format === "json") {
    return NextResponse.json({ url: authUrl });
  }

  return NextResponse.redirect(authUrl);
}
