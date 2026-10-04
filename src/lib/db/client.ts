import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Creates a Supabase client for SERVER-SIDE operations (API routes, server actions, Inngest functions).
 * Uses the service role key which bypasses RLS — caller code is responsible for tenant scoping.
 *
 * @returns A new SupabaseClient instance per call (no stale singleton in serverless).
 */
export function createServerSupabaseClient(): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Creates a Supabase client for CLIENT-SIDE (browser) usage.
 * Uses the anon key — relies on RLS policies for tenant isolation.
 *
 * @returns A SupabaseClient configured for browser persistence.
 */
export function createBrowserSupabaseClient(): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}
