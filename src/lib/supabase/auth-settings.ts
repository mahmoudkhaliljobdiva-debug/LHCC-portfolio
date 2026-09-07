import "server-only";

/** Check hosted configuration before signup so a known mismatch cannot create an unusable account. */
export async function passwordSignupReady(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  const response = await fetch(new URL("/auth/v1/settings", url), {
    headers: { apikey: key },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return false;
  const settings: unknown = await response.json();
  return typeof settings === "object" && settings !== null
    && "mailer_autoconfirm" in settings && settings.mailer_autoconfirm === true
    && "disable_signup" in settings && settings.disable_signup === false;
}
