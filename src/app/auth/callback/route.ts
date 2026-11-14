import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next = requestedNext === "/login/update-password" ? requestedNext : "/";

  if (code && !tokenHash) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return callbackRedirect(next, request.url);
    } catch {
      // Return a neutral recovery error without exposing provider details.
    }
  }

  // Admin invitations have no recipient-side PKCE verifier. The invitation
  // template sends a one-time hash directly here; Supabase verifies/consumes it
  // and the SSR client writes session cookies. No role comes from URL metadata.
  if (!code && tokenHash && tokenHash.length <= 2048 && type === "invite") {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "invite" });
      if (!error) return callbackRedirect("/login/update-password", request.url);
    } catch {
      // Invalid/expired/replayed invitations get the same neutral error.
    }
  }

  return callbackRedirect("/login?reason=recovery-error", request.url);
}

function callbackRedirect(path: string, origin: string) {
  const response = NextResponse.redirect(new URL(path, origin));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
