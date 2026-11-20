"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { liveRoute } from "@/lib/live-sync/routing";

const stateSchema = z.object({ userId: z.uuid(), role: z.enum(["ADMIN","TEACHER","STUDENT"]),
  status: z.enum(["ACTIVE","INACTIVE","EXPIRED"]), revision: z.string(), bankAllowed: z.boolean().nullable() });
export type LiveState = z.infer<typeof stateSchema>;
export async function readLiveState(path: string): Promise<LiveState | null> {
  if (typeof path !== "string" || path.length > 1500 || !path.startsWith("/")) throw new Error("Invalid live scope.");
  if (!await getAuthenticatedUser()) return null;
  const scope = liveRoute(path), db = await createClient();
  const { data, error } = await db.rpc("live_sync_state", {
    ...(scope.bankId ? { bank_id: scope.bankId } : {}), ...(scope.attemptId ? { attempt_id: scope.attemptId } : {}),
  });
  if (error?.code === "42501") return null; // Deleted/missing profile: clear protected UI, not a connection retry.
  if (error) throw new Error("Live access could not be verified.");
  return stateSchema.parse(data);
}
