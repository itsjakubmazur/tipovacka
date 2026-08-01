"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/ui/reveal";

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
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-left"
      >
        <Users className="size-3.5 shrink-0" />
        Netipovalo ještě {missing.length}{" "}
        {missing.length === 1 ? "člověk" : missing.length <= 4 ? "lidi" : "lidí"}
        <ChevronDown
          className={cn(
            "ml-auto size-3.5 shrink-0 transition-transform duration-500 ease-out motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </button>
      <Reveal open={open}>
        <p className="pt-1 text-neutral-600 dark:text-neutral-300">{missing.join(", ")}</p>
      </Reveal>
    </div>
  );
}
