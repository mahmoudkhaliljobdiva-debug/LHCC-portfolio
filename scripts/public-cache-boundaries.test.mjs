import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const get = async path => readFile(path, "utf8");
const [publicCache, catalog, portfolio, server, proxy, routes] = await Promise.all([
  get("src/lib/cache/public-content.ts"),
  get("src/lib/learning/server.ts"),
  get("src/lib/portfolio/server.ts"),
  get("src/lib/supabase/server.ts"),
  get("src/lib/supabase/proxy.ts"),
  get("src/proxy.ts"),
]);
assert(publicCache.includes("catalog_revision"), "Published content uses live revision");
assert(publicCache.includes("persistSession: false"), "Public client never persists a session");
assert(!publicCache.includes("serviceRole") && !publicCache.includes("SUPABASE_SECRET_KEY"), "No privileged key in cached data source");
assert(catalog.includes("unstable_cache") && catalog.includes("createPublicReadClient"), "Published catalog shares a public cache");
assert(portfolio.includes("unstable_cache") && portfolio.includes("createPublicReadClient"), "Published portfolio shares a public cache");
assert(catalog.includes("getPublicContentRevision") && portfolio.includes("getPublicContentRevision"), "Both caches are version-keyed");
assert(!catalog.includes('getCachedStudent') && !portfolio.includes('getAuthenticatedProfile'), "No user-specific caching");
assert(server.includes("cache(async function createClient()"), "Session client is request-scoped");
assert(proxy.includes('response.headers.set("Cache-Control", "private, no-store, max-age=0")'), "No CDN caching of refreshed sessions");
assert(proxy.includes("Object.entries(cacheHeaders"), "Supabase refresh headers are propagated");
assert(routes.includes("api/live/catalog"), "Public revision endpoint bypasses session refresh");
console.log("PASS: published-only cache and per-request session boundaries");
