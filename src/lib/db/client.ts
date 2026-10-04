import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let cachedServerClient: SupabaseClient | null = null;
let cachedBrowserClient: SupabaseClient | null = null;

/**
 * Retrieves or creates a cached Supabase client for SERVER-SIDE operations
 * (API routes, server actions, Inngest functions).
 * Uses connection pooling and avoids re-allocating fetch agents per request.
 */
export function createServerSupabaseClient(): SupabaseClient {
  if (cachedServerClient) {
    return cachedServerClient;
  }

  cachedServerClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: "public",
    },
  });

  return cachedServerClient;
}

/**
 * Retrieves or creates a cached Supabase client for CLIENT-SIDE (browser) usage.
 * Uses the anon key — relies on RLS policies for tenant isolation.
 */
export function createBrowserSupabaseClient(): SupabaseClient {
  if (typeof window !== "undefined" && cachedBrowserClient) {
    return cachedBrowserClient;
  }

  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  if (typeof window !== "undefined") {
    cachedBrowserClient = client;
  }

  return client;
}
