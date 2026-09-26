"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type PollFight = {
  fightId: string;
  fighterAId: string;
  fighterAName: string;
  fighterBId: string;
  fighterBName: string;
};

/** One-tap hype poll for the next fight of a live gala, pinned at the
 * top of the kecárna panel. Votes live in fight_poll_votes (separate
 * from predictions, which are locked by now - this is pure watch-party
 * fun), one per user per fight, switchable by tapping the other side. */
export function LiveFightPoll({
  eventId,
  userId,
  fight,
}: {
  eventId: string;
  userId: string;
  fight: PollFight;
}) {
  const supabase = createClient();
  const [votes, setVotes] = useState<{ user_id: string; fighter_id: string }[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("fight_poll_votes")
        .select("user_id, fighter_id")
        .eq("fight_id", fight.fightId);
      if (data && !cancelled) setVotes(data);
    }

    load();
    const channel = supabase
      .channel(`fight-poll-${fight.fightId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fight_poll_votes", filter: `event_id=eq.${eventId}` },
        load
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, eventId, fight.fightId]);

  async function vote(fighterId: string) {
    setVotes((prev) => [
      ...prev.filter((v) => v.user_id !== userId),
      { user_id: userId, fighter_id: fighterId },
    ]);
    await supabase
      .from("fight_poll_votes")
      .upsert(
        { event_id: eventId, fight_id: fight.fightId, user_id: userId, fighter_id: fighterId },
        { onConflict: "fight_id,user_id" }
      );
  }

  const aVotes = votes.filter((v) => v.fighter_id === fight.fighterAId).length;
  const bVotes = votes.filter((v) => v.fighter_id === fight.fighterBId).length;
  const total = aVotes + bVotes;
  const myVote = votes.find((v) => v.user_id === userId)?.fighter_id ?? null;

  return (
    /* Compact on purpose. Docked in the sidebar the chat is a fixed-height
     * column, the poll never shrinks, and the message list is the only thing
     * that gives - so every row spent here comes straight out of the
     * conversation. The share used to be a separate bar under the buttons;
     * painting it behind each name instead says the same thing in one row
     * fewer, and next to the count rather than away from it. */
    <div className="border-b border-black/5 px-4 py-2.5 dark:border-white/10">
      <p className="flex items-baseline justify-between gap-2 text-[11px] font-medium uppercase text-neutral-500 dark:text-neutral-400">
        <span className="truncate">Kdo vezme další zápas?</span>
        {total > 0 && (
          <span className="shrink-0 tabular-nums normal-case">
            {total} {total === 1 ? "hlas" : total <= 4 ? "hlasy" : "hlasů"}
          </span>
        )}
      </p>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        {[
          { id: fight.fighterAId, name: fight.fighterAName, count: aVotes },
          { id: fight.fighterBId, name: fight.fighterBName, count: bVotes },
        ].map((side) => (
          <button
            key={side.id}
            type="button"
            onClick={() => vote(side.id)}
            className={cn(
              "relative flex items-center justify-between gap-2 overflow-hidden rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors",
              myVote === side.id
                ? "glass-accent-soft border-accent"
                : "glass-pill border hover:border-neutral-400"
            )}
          >
            {/* the share, as the button's own fill - aria-hidden because the
                count beside it already says it in words */}
            {total > 0 && (
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-accent/20 transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${Math.round((side.count / total) * 100)}%` }}
              />
            )}
            <span className="relative truncate">{side.name}</span>
            {total > 0 && (
              <span className="relative shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                {side.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
