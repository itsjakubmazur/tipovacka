"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { isStandalone } from "@/lib/push";

/** Invisible tracker: when the app runs installed (standalone display
 * mode, i.e. launched from the home screen), stamp it on the profile so
 * the superadmin overview can tell who actually has the PWA. Once per
 * session is plenty. */
export function StandalonePing({ userId }: { userId: string }) {
  useEffect(() => {
    if (!isStandalone()) return;
    if (sessionStorage.getItem("standalone-pinged")) return;
    sessionStorage.setItem("standalone-pinged", "1");
    const supabase = createClient();
    supabase
      .from("profiles")
      .update({ standalone_seen_at: new Date().toISOString() })
      .eq("id", userId)
      .then(({ error }) => {
        if (error) sessionStorage.removeItem("standalone-pinged");
      });
  }, [userId]);

  return null;
}
