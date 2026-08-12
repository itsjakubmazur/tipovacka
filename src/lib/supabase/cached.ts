import { createClient } from "@supabase/supabase-js";

/** Service-role client for use inside unstable_cache callbacks.
 *
 * The regular server client (src/lib/supabase/server.ts) is cookie-bound,
 * which unstable_cache's callback must never touch - the RLS-scoped session
 * cookie can't leak into a cache shared across every viewer. This client
 * has no session and bypasses RLS instead, so cached fetchers select only
 * the same non-personalized columns the equivalent live query already did.
 */
export function createCachedClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}
