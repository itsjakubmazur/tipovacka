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
  const aPct = total > 0 ? Math.round((aVotes / total) * 100) : 50;

  return (
    <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <p className="text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">
        Kdo vezme další zápas?
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {[
          { id: fight.fighterAId, name: fight.fighterAName, count: aVotes },
          { id: fight.fighterBId, name: fight.fighterBName, count: bVotes },
        ].map((side) => (
          <button
            key={side.id}
            type="button"
            onClick={() => vote(side.id)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              myVote === side.id
                ? "border-[#FFD400] bg-[#FFD400]/15"
                : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500"
            )}
          >
            <span className="truncate">{side.name}</span>
            {total > 0 && (
              <span className="shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                {side.count}
              </span>
            )}
          </button>
        ))}
      </div>
      {total > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
          <div
            className="h-full rounded-full bg-[#FFD400] transition-all duration-500"
            style={{ width: `${aPct}%` }}
          />
        </div>
      )}
    </div>
  );
}
