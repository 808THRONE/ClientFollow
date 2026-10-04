import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { SESSION_COOKIE } from "@/lib/session-constants";

/**
 * Paths that do NOT require authentication.
 */
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/terms",
  "/privacy",
  "/auth/callback",
  "/api/inngest",
  "/api/auth/gmail",
  "/api/auth/gmail/callback",
  "/api/webhooks/gmail",
  "/api/webhooks/whatsapp",
  "/api/webhooks/calendar",
  "/api/webhooks/stripe",
  "/api/webhooks/inbound",
  "/api/auth/session",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/health",
  "/icon.svg",
  "/favicon.ico",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/api/inngest") ||
    pathname.startsWith("/api/webhooks")
  ) {
    return true;
  }
  return false;
}

/**
 * Attaches comprehensive production security headers and correlation ID to all HTTP responses (S7, S9, S10).
 */
function applySecurityHeaders(response: NextResponse, correlationId: string): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("x-correlation-id", correlationId);
  response.headers.set("x-request-id", correlationId);

  if (env.isProduction) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }

  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.inngest.com",
    "frame-src 'self' https://js.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", cspHeader);

  return response;
}

/**
 * Verifies the HMAC-signed session cookie using Web Crypto API (Edge-compatible).
 */
async function verifySessionCookie(token: string): Promise<boolean> {
  try {
    const secret = env.SESSION_SECRET;
    const dotIndex = token.indexOf(".");
    if (dotIndex === -1) return false;

    const encoded = token.substring(0, dotIndex);
    const sig = token.substring(dotIndex + 1);
    if (!encoded || !sig) return false;

    // Import key for HMAC using Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // Sign the encoded payload
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(encoded));

    // Convert to base64url for comparison
    const expectedSig = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    return sig === expectedSig;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const correlationId =
    request.headers.get("x-correlation-id") ||
    request.headers.get("x-request-id") ||
    crypto.randomUUID();

  // Forward correlation ID downstream in request headers
  request.headers.set("x-correlation-id", correlationId);
  request.headers.set("x-request-id", correlationId);

  // Always allow public paths through with security headers
  if (isPublicPath(pathname)) {
    return applySecurityHeaders(NextResponse.next({ request }), correlationId);
  }

  // ── Check session cookie (works with or without live Supabase) ──
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const hasValidSession = sessionToken ? await verifySessionCookie(sessionToken) : false;

  // ── If Supabase is configured, also check Supabase session ──
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  const isLiveSupabase = env.isSupabaseLive;

  let hasSupabaseSession = false;

  if (isLiveSupabase) {
    let supabaseResponse = NextResponse.next({ request });
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasSupabaseSession = !!user;

    if (hasSupabaseSession) {
      return applySecurityHeaders(supabaseResponse, correlationId);
    }
  }

  // ── Auth decision: allow if either session is valid ──
  if (hasValidSession || hasSupabaseSession) {
    return applySecurityHeaders(NextResponse.next({ request }), correlationId);
  }

  // ── Not authenticated → redirect to login ──
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("returnTo", pathname);
  return applySecurityHeaders(NextResponse.redirect(url), correlationId);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
