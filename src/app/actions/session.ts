"use server";

import { cookies } from "next/headers";
import { signToken, verifyToken } from "@/lib/session-utils";
import { env } from "@/lib/env";

const SESSION_COOKIE = "cf_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * Server action: Create session after successful login/signup.
 */
export async function createSessionAction(email: string, orgId: string) {
  if (!email || !orgId) {
    return { success: false, error: "email and orgId are required" };
  }

  const token = signToken({ email, orgId, ts: Date.now().toString() });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return { success: true };
}

/**
 * Server action: Destroy session on logout.
 */
export async function destroySessionAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return { success: true };
}

/**
 * Server action: Get current session payload (if valid).
 */
export async function getSessionAction(): Promise<Record<string, string> | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}
