/**
 * Centralized Environment Configuration & Validation
 *
 * This module validates ALL required environment variables at import time.
 * In production, missing variables cause a hard crash at startup — not silent failures at runtime.
 * In development, warnings are logged for missing optional vars.
 */

const isProduction = process.env.NODE_ENV === "production";
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Reads an env var. Throws in production runtime if required and missing.
 * In development or during Next.js production build phase, returns the fallback if provided.
 */
function requireEnv(key: string, devFallback?: string): string {
  const value = process.env[key];
  if (value && value.trim().length > 0) {
    return value.trim();
  }

  // During Next.js static page collection build phase or in development, allow dev fallback
  if (devFallback !== undefined && (!isProduction || isBuildPhase)) {
    return devFallback;
  }

  if (isProduction && !isBuildPhase) {
    throw new Error(
      `[ENV] Missing required environment variable: ${key}. ` +
        `The application cannot start in production runtime without it.`
    );
  }

  if (devFallback !== undefined) {
    return devFallback;
  }

  throw new Error(
    `[ENV] Missing required environment variable: ${key}. ` +
      `Set it in .env.local or provide a dev fallback.`
  );
}

/**
 * Reads an optional env var. Returns undefined if not set.
 */
function optionalEnv(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

// ─── App Core ─────────────────────────────────────────────────────────────────

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  isProduction,
  APP_URL: requireEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),

  // ─── Supabase ─────────────────────────────────────────────────────────────
  SUPABASE_URL: requireEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"),
  SUPABASE_ANON_KEY: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "dev-anon-key"),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv("SUPABASE_SERVICE_ROLE_KEY", "dev-service-role-key"),

  /** True when Supabase is configured with real credentials (not dev placeholder) */
  get isSupabaseLive(): boolean {
    return (
      !this.SUPABASE_URL.includes("example.supabase.co") &&
      this.SUPABASE_ANON_KEY !== "dev-anon-key"
    );
  },

  // ─── AWS KMS ──────────────────────────────────────────────────────────────
  AWS_REGION: requireEnv("AWS_REGION", "us-east-1"),
  AWS_ACCESS_KEY_ID: requireEnv("AWS_ACCESS_KEY_ID", "dev-access-key"),
  AWS_SECRET_ACCESS_KEY: requireEnv("AWS_SECRET_ACCESS_KEY", "dev-secret-key"),
  KMS_MASTER_KEY_ID: requireEnv(
    "KMS_MASTER_KEY_ID",
    "arn:aws:kms:us-east-1:123456789012:key/dev-key"
  ),

  /** True when AWS KMS is configured with real credentials (not dev placeholder) */
  get isKmsLive(): boolean {
    return (
      this.AWS_ACCESS_KEY_ID !== "dev-access-key" &&
      !this.KMS_MASTER_KEY_ID.includes("dev-key")
    );
  },

  // ─── Inngest ──────────────────────────────────────────────────────────────
  INNGEST_EVENT_KEY: optionalEnv("INNGEST_EVENT_KEY"),
  INNGEST_SIGNING_KEY: optionalEnv("INNGEST_SIGNING_KEY"),

  // ─── Google Cloud (Gmail OAuth & Pub/Sub) ─────────────────────────────────
  GOOGLE_CLIENT_ID: optionalEnv("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: optionalEnv("GOOGLE_CLIENT_SECRET"),
  GOOGLE_REDIRECT_URI: optionalEnv("GOOGLE_REDIRECT_URI"),
  GOOGLE_PUBSUB_TOPIC: optionalEnv("GOOGLE_PUBSUB_TOPIC"),

  // ─── WhatsApp Business Cloud API ──────────────────────────────────────────
  WHATSAPP_API_TOKEN: optionalEnv("WHATSAPP_API_TOKEN"),
  WHATSAPP_PHONE_NUMBER_ID: optionalEnv("WHATSAPP_PHONE_NUMBER_ID"),
  WHATSAPP_BUSINESS_ACCOUNT_ID: optionalEnv("WHATSAPP_BUSINESS_ACCOUNT_ID"),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: requireEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "dev-verify-token"),
  WHATSAPP_APP_SECRET: optionalEnv("WHATSAPP_APP_SECRET"),

  // ─── AI / LLM ────────────────────────────────────────────────────────────
  OPENAI_API_KEY: optionalEnv("OPENAI_API_KEY"),
  OPENAI_BASE_URL: optionalEnv("OPENAI_BASE_URL"),
  OPENAI_MODEL: optionalEnv("OPENAI_MODEL"),
  ANTHROPIC_API_KEY: optionalEnv("ANTHROPIC_API_KEY"),

  // ─── Stripe ───────────────────────────────────────────────────────────────
  STRIPE_SECRET_KEY: requireEnv("STRIPE_SECRET_KEY", "sk_test_dev"),
  STRIPE_WEBHOOK_SECRET: requireEnv("STRIPE_WEBHOOK_SECRET", "whsec_dev"),
  STRIPE_PUBLISHABLE_KEY: requireEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "pk_test_dev"),
  STRIPE_PRICE_STARTER: requireEnv("STRIPE_PRICE_STARTER", "price_starter_19"),
  STRIPE_PRICE_GROWTH: requireEnv("STRIPE_PRICE_GROWTH", "price_growth_49"),
  STRIPE_PRICE_PRO: requireEnv("STRIPE_PRICE_PRO", "price_pro_99"),

  // ─── Session ──────────────────────────────────────────────────────────────
  SESSION_SECRET: (() => {
    const secret = requireEnv("SESSION_SECRET", "clientfollow-dev-secret-key-change-in-prod-32ch");
    if (isProduction && secret.length < 32) {
      throw new Error(
        "[ENV] SESSION_SECRET must be at least 32 characters in production. " +
          `Current length: ${secret.length}`
      );
    }
    return secret;
  })(),
} as const;
