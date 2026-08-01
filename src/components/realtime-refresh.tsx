"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Keeps a server-rendered page current while you're looking at it.
 *
 * The websocket alone isn't enough. On iOS the socket is killed the moment
 * the PWA goes to the background - which is exactly what happens when a push
 * notification arrives and you tap it: you come back to a page whose live
 * connection died before the result it's telling you about was even entered.
 * supabase-js doesn't always notice, so the page sat on stale results until
 * the app was force-quit.
 *
 * So there are three ways back to fresh here, in order of how quickly they
 * fire: the subscription, a refresh whenever the page becomes visible again
 * (which covers the whole background/foreground story), and - only while a
 * gala is actually running - a slow poll as the final backstop. */
export function RealtimeRefresh({
  table,
  tables,
  pollMs,
}: {
  /** single table to watch */
  table?: string;
  /** or several, sharing one visibility handler and one poll */
  tables?: string[];
  /** poll interval while the page is visible; omit to rely on events only */
  pollMs?: number;
}) {
  const router = useRouter();
  const watched = (tables ?? (table ? [table] : [])).join(",");
  // a refresh in flight shouldn't stack up behind a second trigger
  const refreshing = useRef(false);

  const refresh = useCallback(() => {
    if (refreshing.current) return;
    refreshing.current = true;
    router.refresh();
    setTimeout(() => {
      refreshing.current = false;
    }, 1500);
  }, [router]);

  useEffect(() => {
    const names = watched ? watched.split(",") : [];
    if (names.length === 0) return;

    const supabase = createClient();
    const channels = names.map((name) =>
      supabase
        .channel(`realtime-${name}`)
        .on("postgres_changes", { event: "*", schema: "public", table: name }, refresh)
        .subscribe()
    );

    return () => {
      for (const channel of channels) supabase.removeChannel(channel);
    };
  }, [refresh, watched]);

  useEffect(() => {
    // Coming back to the app is itself a reason to distrust what's on screen -
    // whatever happened while it was in the background never reached us.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    // and after a wake from sleep the socket may be gone without any event
    window.addEventListener("online", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (!pollMs) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, pollMs);
    return () => clearInterval(id);
  }, [pollMs, refresh]);

  return null;
}
