import crypto from "crypto";
import { env } from "@/lib/env";

/**
 * Creates a signed session token for the authenticated user.
 * HMAC-signed cookie — works without live Supabase.
 */
export function signToken(payload: Record<string, string>): string {
  const secret = env.SESSION_SECRET;
  const data = JSON.stringify(payload);
  const encoded = Buffer.from(data).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

/**
 * Verifies a signed session token and returns the payload, or null if invalid.
 */
export function verifyToken(token: string): Record<string, string> | null {
  try {
    const secret = env.SESSION_SECRET;
    const [encoded, sig] = token.split(".");
    if (!encoded || !sig) return null;
    const expectedSig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}
