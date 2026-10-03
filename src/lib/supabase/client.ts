import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/**
 * Creates a Supabase browser client with automatic cookie handling for client components.
 */
export function createClient() {
  return createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}

export const getSupabaseBrowserClient = createClient;
