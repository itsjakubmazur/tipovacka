"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

  const [open, setOpen] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(initialFightId);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(fightId: string) {
    if (locked || !fightId) return;
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

  const pickedFight = fights.find((f) => f.id === pickedId);

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-sm font-semibold"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          🥊 Bonus tip: Fight of the Night
        </span>
        {!open && pickedFight && (
          <span className="truncate text-xs font-normal text-neutral-500 dark:text-neutral-400">
            {pickedFight.fighterAName} vs {pickedFight.fighterBName}
          </span>
        )}
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          <select
            value={pickedId ?? ""}
            disabled={locked}
            onChange={(e) => pick(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="" disabled>
              Vyber zápas…
            </option>
            {fights.map((fight) => (
              <option key={fight.id} value={fight.id}>
                {fight.fighterAName} vs {fight.fighterBName}
              </option>
            ))}
          </select>
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
      )}
    </div>
  );
}
