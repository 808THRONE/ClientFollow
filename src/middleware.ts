import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

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
  "/api/checkout",
  "/api/auth/session",
  "/api/auth/login",
  "/icon.svg",
  "/favicon.ico",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/api/inngest") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/auth")
  ) {
    return true;
  }
  return false;
}

const SESSION_COOKIE = "cf_session";

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

  // Always allow public paths through
  if (isPublicPath(pathname)) {
    return NextResponse.next({ request });
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
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasSupabaseSession = !!user;

    if (hasSupabaseSession) {
      return supabaseResponse;
    }
  }

  // ── Auth decision: allow if either session is valid ──
  if (hasValidSession || hasSupabaseSession) {
    return NextResponse.next({ request });
  }

  // ── Not authenticated → redirect to login ──
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("returnTo", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
