"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function watchersWord(n: number): string {
  if (n === 1) return "sleduje";
  return "sledují";
}

/** Who else has this gala open right now, over Supabase realtime presence.
 *
 * Regular tippers only ever see a count - knowing the party is watching with
 * you is the point, knowing exactly who is watching is surveillance. Admins
 * get the names so they can tell whether the party has actually turned up. */
export function WatchingNow({
  eventId,
  userId,
  nickname,
  showNames,
}: {
  eventId: string;
  userId: string;
  nickname: string;
  showNames: boolean;
}) {
  const [watchers, setWatchers] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`watching-${eventId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ nickname: string }>();
        // one entry per person, even with the app open on two devices
        const names = Object.values(state)
          .map((entries) => entries[0]?.nickname)
          .filter((n): n is string => Boolean(n));
        setWatchers(names);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") channel.track({ nickname });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, userId, nickname]);

  if (watchers.length === 0) return null;

  const others = watchers.filter((n) => n !== nickname);

  return (
    <span className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
      <Eye className="size-3.5 shrink-0 text-yellow-600 dark:text-accent" />
      <span className="truncate">
        <strong className="text-black dark:text-white">{watchers.length}</strong>{" "}
        {watchersWord(watchers.length)}
        {showNames && others.length > 0 && ` (${others.join(", ")})`}
      </span>
    </span>
  );
}
