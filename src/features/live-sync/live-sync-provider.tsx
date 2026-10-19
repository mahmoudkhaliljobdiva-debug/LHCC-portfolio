"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, useTransition } from "react";
import { readLiveState, type LiveState } from "@/actions/live-sync";
import { affectsRoute, liveRoute, parseLiveHint } from "@/lib/live-sync/routing";

const Connection = createContext("Connecting to live updates…");
export function LiveConnectionStatus() {
  return <span className="text-xs text-slate-500" role="status">{useContext(Connection)}</span>;
}

// One owner at the root: at most three private channels sharing one connection.
export function LiveSyncProvider({ children }: { readonly children: React.ReactNode }) {
  const router = useRouter(), pathname = usePathname();
  const [identity, setIdentity] = useState<{ id: string; role: string } | null>(null);
  const [connection, setConnection] = useState("Connecting to live updates…");
  const [blocked, setBlocked] = useState<string | null>(null);
  const [, transition] = useTransition();
  const refresh = useRef<(force?: boolean) => void>(() => {});
  const livePath = useRef(pathname);
  const state = useRef<LiveState | null>(null);

  useEffect(() => {
    let disposed = false, running = false, queued = false, forced = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let catalogVersion: string | undefined;
    const reconcile = async () => {
      timer = undefined;
      if (disposed || document.hidden || !navigator.onLine) return;
      if (running) { queued = true; return; }
      running = true;
      const force = forced; forced = false;
      const path = livePath.current;
      try {
        const next = await readLiveState(path);
        if (disposed || path !== livePath.current) return;
        const previous = state.current; state.current = next;
        setIdentity(current => current?.id === next?.userId && current?.role === next?.role ? current
          : next ? { id: next.userId, role: next.role } : null);
        if (next && liveRoute(path).protected) {
          const roleRoot = path.split("/")[1]?.toUpperCase();
          if (next.status !== "ACTIVE" || (["ADMIN","TEACHER","STUDENT"].includes(roleRoot ?? "") && roleRoot !== next.role)) {
            setBlocked("Your account access has changed. Opening your authorized workspace…");
            const target = next.status === "INACTIVE" ? "/account/inactive" : next.status === "EXPIRED" ? "/account/expired" : `/${next.role.toLowerCase()}`;
            router.replace(target as Route); return;
          }
          if (next.bankAllowed === false) {
            setBlocked("Access to this material is no longer available. Your saved progress is retained."); return;
          }
        }
        if (!next && liveRoute(path).protected) {
          setBlocked("Your session has ended. Please sign in again."); router.replace("/login"); return;
        }
        setBlocked(null);
        if (next && ["/account/inactive","/account/expired"].includes(path) && next.status === "ACTIVE") {
          router.replace(`/${next.role.toLowerCase()}` as Route); return;
        }
        if (next && ((previous && previous.revision !== next.revision) || force)) transition(() => router.refresh());
        if (!next && liveRoute(path).publicCatalog) {
          const response = await fetch("/api/live/catalog");
          if (!response.ok) throw new Error("Catalog reconciliation unavailable");
          const data: unknown = await response.json();
          if (data && typeof data === "object" && "revision" in data && typeof data.revision === "string") {
            if (catalogVersion !== undefined && catalogVersion !== data.revision) transition(() => router.refresh());
            catalogVersion = data.revision;
          }
        }
      } catch { if (!disposed) setConnection("Updates delayed — reconnecting automatically"); }
      finally {
        running = false;
        if (queued && !disposed) { queued = false; schedule(); }
      }
    };
    function schedule(force = false) {
      forced ||= force;
      if (!timer) timer = setTimeout(() => void reconcile(), 250);
    }
    refresh.current = schedule;
    const wake = () => { if (!document.hidden) schedule(); };
    const offline = () => setConnection("Offline — saved changes will reconcile on reconnect");
    window.addEventListener("online", wake); window.addEventListener("offline", offline);
    window.addEventListener("focus", wake); document.addEventListener("visibilitychange", wake);
    window.addEventListener("storage", wake);
    // Revision-only, bounded safety net for lost events; no expensive dashboard polling.
    const interval = setInterval(wake, 60000);
    schedule();
    return () => {
      disposed = true; if (timer) clearTimeout(timer); clearInterval(interval);
      window.removeEventListener("online", wake); window.removeEventListener("offline", offline);
      window.removeEventListener("focus", wake); document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("storage", wake);
    };
  }, [router]);

  useEffect(() => { livePath.current = pathname; refresh.current(); }, [pathname]);
  useEffect(() => {
    if (!identity) return;
    let stopped = false;
    let dispose = () => {};
    const topics = [`lhcc:user:${identity.id}`, "lhcc:catalog", ...(identity.role === "ADMIN" ? ["lhcc:admin"] : [])];
    const connect = async () => {
      // Anonymous portfolio visitors never load the WebSocket client bundle.
      const { createClient } = await import("@/lib/supabase/client");
      if (stopped) return;
      const db = createClient();
      const auth = db.auth.onAuthStateChange(() => refresh.current());
      const channels = topics.map(topic => db.channel(topic, { config: { private: true } })
        .on("broadcast", { event: "invalidate" }, message => {
          const hint = parseLiveHint(message.payload);
          if (!stopped && hint && affectsRoute(hint, livePath.current)) refresh.current();
        }));
      dispose = () => { auth.data.subscription.unsubscribe(); for (const channel of channels) void db.removeChannel(channel); };
      const { data } = await db.auth.getSession(); // Transport credentials only; DB/RPCs authorize every read.
      if (stopped) return;
      if (data.session) await db.realtime.setAuth(data.session.access_token);
      if (stopped) return;
      for (const channel of channels) channel.subscribe(status => {
        if (stopped) return;
        if (status === "SUBSCRIBED") { setConnection("Live updates connected"); refresh.current(); }
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConnection("Updates delayed — reconnecting automatically");
      });
    };
    void connect().catch(() => { if (!stopped) setConnection("Updates delayed — reconnecting automatically"); });
    return () => { stopped = true; dispose(); };
  }, [identity]);

  return <Connection.Provider value={connection}>{blocked && liveRoute(pathname).protected
    ? <main className="mx-auto max-w-3xl p-6"><p role="alert" className="rounded-xl border bg-white p-5 text-slate-800 dark:bg-slate-900 dark:text-slate-100">{blocked}</p></main>
    : children}</Connection.Provider>;
}
