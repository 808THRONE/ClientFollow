/**
 * Supabase Auth and Multi-Tenant Session Resolution Utilities
 */

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/auth/callback",
  "/api/inngest",
  "/api/webhooks/gmail",
  "/api/webhooks/whatsapp",
  "/api/webhooks/calendar",
  "/api/webhooks/stripe",
  "/api/webhooks/inbound",
  "/icon.svg",
  "/favicon.ico",
];

/**
 * Checks whether a given path is accessible without requiring a tenant session.
 */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) {
    return true;
  }

  // Next.js static asset and internal route checks
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

export interface TenantSession {
  userId: string;
  email: string | null;
  orgId: string;
  role: "admin" | "operator";
}

/**
 * Resolves the active organization tenant context for an authenticated user.
 */
export function resolveTenantSession(
  user: any,
  fallbackOrgIdHeader?: string | null
): TenantSession {
  if (!user || !user.id) {
    throw new Error("Cannot resolve tenant session for unauthenticated user");
  }

  const metaOrgId = user.user_metadata?.org_id;
  const orgId = metaOrgId || fallbackOrgIdHeader || "org_default_trial";
  const role = user.user_metadata?.role === "admin" ? "admin" : "operator";

  return {
    userId: user.id,
    email: user.email || null,
    orgId,
    role,
  };
}
