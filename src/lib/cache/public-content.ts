import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
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

/** The public revision is identical for every visitor, so poll it at most
 * once per short cache window instead of for every simultaneous student.
 * SQL change triggers bump the revision; UI may lag by a few seconds (max 5s
 * before revalidation begins) after a catalog edit. No user data is cached.
 */
const getCachedPublicRevision = unstable_cache(
  async (): Promise<string> => {
    const { data, error } = await createPublicReadClient().rpc("catalog_revision");
    if (error || data === null) throw new Error("Unable to load the public catalog revision.");
    return data;
  },
  ["lhcc-public-content-revision-v1"],
  { revalidate: 5, tags: ["lhcc-public-content-revision"] },
);

// A second, request-local layer deduplicates identical calls within one render.
export const getPublicContentRevision = cache(async () => getCachedPublicRevision());
