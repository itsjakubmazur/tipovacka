"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Pre-lock nudge: which of the group still hasn't tipped this event.
 * Loads in the background after the page renders (so it never slows the
 * page down) and only appears once it knows there's someone missing.
 * Participation comes from the event_tipped_user_ids RPC - before lock
 * RLS hides the actual picks, so a plain query couldn't tell who tipped. */
export function WhoHasntTipped({ eventId }: { eventId: string }) {
  const [missing, setMissing] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const [{ data: profiles }, { data: tipped }] = await Promise.all([
        supabase.from("profiles").select("id, nickname"),
        supabase.rpc("event_tipped_user_ids", { p_event_id: eventId }),
      ]);
      if (cancelled || !profiles) return;
      const tippedIds = new Set((tipped ?? []) as string[]);
      const names = profiles
        .filter((p) => !tippedIds.has(p.id))
        .map((p) => p.nickname ?? "Bez přezdívky")
        .sort((a, b) => a.localeCompare(b, "cs"));
      setMissing(names);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (!missing || missing.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/45 bg-white/35 text-sm shadow-lg shadow-black/20 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 p-3 text-left font-medium"
      >
        <Users className="size-4 text-neutral-500 dark:text-neutral-400" />
        Kdo ještě netipoval ({missing.length})
        <ChevronDown className={cn("ml-auto size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <p className="px-3 pb-3 text-neutral-600 dark:text-neutral-300">{missing.join(", ")}</p>
      )}
    </div>
  );
}
