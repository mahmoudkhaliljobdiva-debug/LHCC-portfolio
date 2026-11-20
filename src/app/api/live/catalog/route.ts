import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const db = await createClient();
  const { data, error } = await db.rpc("catalog_revision");
  if (error) return Response.json({ error: "Catalog status unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json({ revision: data }, { headers: { "Cache-Control": "public, max-age=10, s-maxage=10, stale-while-revalidate=10" } });
}
