import "server-only";
import { cache } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/** Anonymous read-only client: never attaches a browser cookie, JWT, or service key.
 * Only use it for functions/tables whose results are identical for all visitors.
 */
export function createPublicReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing public Supabase configuration.");
  return createSupabaseClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

/** Request-local revision read; all public content mutation triggers bump this revision.
 * Revision is used as an argument to shared cache functions, so edits never wait for
 * a fixed TTL. The cache also expires periodically as a safety net.
 */
export const getPublicContentRevision = cache(async (): Promise<string> => {
  const { data, error } = await createPublicReadClient().rpc("catalog_revision");
  if (error || data === null) throw new Error("Unable to load the public catalog revision.");
  return data;
});
