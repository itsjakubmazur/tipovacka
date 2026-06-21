"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
  actualFight,
}: {
  eventId: string;
  userId: string;
  fights: FightOption[];
  initialFightId: string | null;
  initialPoints: number | null;
  locked: boolean;
  actualFight?: { fighterAName: string; fighterBName: string } | null;
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
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-lg shadow-black/20 dark:border-neutral-700 dark:bg-neutral-800 dark:shadow-black/60">
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
          <span className="truncate text-xs font-normal text-neutral-500 dark:text-neutral-300">
            {pickedFight.fighterAName} vs {pickedFight.fighterBName}
          </span>
        )}
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
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
          {locked && actualFight && (
            <p className="text-xs font-medium">
              🏆 Skutečný Fight of the Night:{" "}
              <span className="text-[#FFD400]">
                {actualFight.fighterAName} vs {actualFight.fighterBName}
              </span>
            </p>
          )}
          <div className="h-4 text-xs text-neutral-500 dark:text-neutral-300">
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
