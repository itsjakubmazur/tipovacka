"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_REPORTS_PER_PAGELOAD = 5;

/** Ships uncaught browser errors to the client_errors table so they
 * show up on the superadmin error page instead of only ever surfacing
 * as a "hele, něco mi to hodilo" screenshot. Capped and deduped per
 * pageload so an error loop can't flood the table, and every failure
 * in here is swallowed - the reporter must never become its own crash. */
export function ErrorReporter() {
  useEffect(() => {
    const supabase = createClient();
    const seen = new Set<string>();
    let sent = 0;

    async function report(message: string, stack: string | null) {
      try {
        if (sent >= MAX_REPORTS_PER_PAGELOAD || seen.has(message)) return;
        seen.add(message);
        sent += 1;
        const { data } = await supabase.auth.getUser();
        if (!data.user) return;
        await supabase.from("client_errors").insert({
          user_id: data.user.id,
          message: message.slice(0, 1000),
          stack: stack?.slice(0, 4000) ?? null,
          url: window.location.pathname,
          user_agent: navigator.userAgent.slice(0, 300),
        });
      } catch {
        // never let the error reporter throw
      }
    }

    function onError(event: ErrorEvent) {
      report(event.message ?? "Unknown error", event.error?.stack ?? null);
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      report(
        reason instanceof Error ? `Unhandled rejection: ${reason.message}` : `Unhandled rejection: ${String(reason)}`,
        reason instanceof Error ? (reason.stack ?? null) : null
      );
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
