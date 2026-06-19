"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type FightOption = { id: string; fighterAName: string; fighterBName: string };

export function FotnPicker({
  eventId,
  userId,
  fights,
  initialFightId,
  initialPoints,
  locked,
}: {
  eventId: string;
  userId: string;
  fights: FightOption[];
  initialFightId: string | null;
  initialPoints: number | null;
  locked: boolean;
}) {
  const supabase = createClient();

  const [pickedId, setPickedId] = useState<string | null>(initialFightId);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(fightId: string) {
    if (locked) return;
    setPickedId(fightId);
    setSaving(true);
    setError(null);
    const { error } = await supabase.from("bonus_predictions").upsert(
      { user_id: userId, event_id: eventId, predicted_fotn_fight_id: fightId },
      { onConflict: "user_id,event_id" }
    );
    setSaving(false);
    if (error) {
      setError("Uložení se nepodařilo.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  if (fights.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
      <p className="text-sm font-semibold">🥊 Bonus tip: Fight of the Night</p>
      <div className="flex flex-col gap-1.5">
        {fights.map((fight) => (
          <button
            key={fight.id}
            type="button"
            disabled={locked}
            onClick={() => pick(fight.id)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed",
              pickedId === fight.id
                ? "border-[#FFD400] bg-[#FFD400]/10 font-semibold"
                : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300"
            )}
          >
            {fight.fighterAName} vs {fight.fighterBName}
          </button>
        ))}
      </div>
      <div className="h-4 text-xs text-neutral-500 dark:text-neutral-400">
        {locked && initialPoints != null
          ? initialPoints > 0
            ? `Trefeno! +${initialPoints} b.`
            : "Netrefeno."
          : saving
            ? "Ukládám…"
            : saved
              ? "Uloženo."
              : null}
        {error && <span className="text-red-600">{error}</span>}
      </div>
    </div>
  );
}
