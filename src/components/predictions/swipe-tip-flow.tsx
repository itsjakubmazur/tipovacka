"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FighterPortrait } from "@/components/fighter-portrait";
import { Badge } from "@/components/ui/badge";
import { ageFromBirthDate, cn } from "@/lib/utils";
import { GLASS_PILL } from "@/lib/pills";
import { weightClassLabel } from "@/lib/weight-classes";
import { METHOD_LABELS } from "@/lib/method-labels";
import type { Fight, Fighter, Method, Prediction } from "@/lib/types";

const AUTO_ADVANCE_MS = 650;

type LocalTip = {
  winnerId: string | null;
  method: Method | null;
  round: number | null;
};

function tipComplete(tip: LocalTip): boolean {
  return Boolean(
    tip.winnerId && tip.method && (tip.method === "DECISION" || tip.round !== null)
  );
}

function TaleOfTheTapeRow({ label, a, b }: { label: string; a: string | null; b: string | null }) {
  if (!a && !b) return null;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
      <span className="text-right font-medium tabular-nums">{a ?? "–"}</span>
      <span className="text-[11px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        {label}
      </span>
      <span className="font-medium tabular-nums">{b ?? "–"}</span>
    </div>
  );
}

/** Full-screen fight-by-fight tipping: tap a fighter, tap method (and
 * round), auto-advance to the next fight - the fast lane for filling a
 * 14-fight card, using the exact same predictions upsert as the cards
 * on the event page. */
export function SwipeTipFlow({
  eventId,
  userId,
  fights,
  initialPredictions,
}: {
  eventId: string;
  userId: string;
  fights: Fight[];
  initialPredictions: Record<string, Prediction>;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [index, setIndex] = useState(() => {
    const firstUntipped = fights.findIndex((f) => !initialPredictions[f.id]);
    return firstUntipped >= 0 ? firstUntipped : 0;
  });
  const [tips, setTips] = useState<Record<string, LocalTip>>(() =>
    Object.fromEntries(
      fights.map((f) => {
        const p = initialPredictions[f.id];
        return [
          f.id,
          {
            winnerId: p?.predicted_winner_id ?? null,
            method: p?.predicted_method ?? null,
            round: p?.predicted_round ?? null,
          },
        ];
      })
    )
  );
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const fight = fights[index];
  const tip = tips[fight.id];
  const tippedCount = useMemo(
    () => fights.filter((f) => tipComplete(tips[f.id])).length,
    [fights, tips]
  );

  async function persist(fightId: string, next: LocalTip) {
    if (!tipComplete(next)) return;
    setError(null);
    const { error } = await supabase.from("predictions").upsert(
      {
        user_id: userId,
        fight_id: fightId,
        predicted_winner_id: next.winnerId,
        predicted_method: next.method,
        predicted_round: next.method === "DECISION" ? null : next.round,
      },
      { onConflict: "user_id,fight_id" }
    );
    if (error) {
      setError("Uložení se nepodařilo.");
      return;
    }
    window.dispatchEvent(
      new CustomEvent("tip-state-changed", { detail: { fightId, tipped: true } })
    );
  }

  function update(partial: Partial<LocalTip>) {
    const next = { ...tip, ...partial };
    if (partial.method === "DECISION") next.round = null;
    setTips((prev) => ({ ...prev, [fight.id]: next }));
    persist(fight.id, next);
    if (tipComplete(next) && index < fights.length - 1) {
      setLeaving(true);
      setTimeout(() => {
        setLeaving(false);
        setIndex((i) => Math.min(i + 1, fights.length - 1));
      }, AUTO_ADVANCE_MS);
    }
  }

  function close() {
    router.push(`/events/${eventId}`);
    router.refresh();
  }

  const done = tippedCount === fights.length;

  return (
    <div className="flex min-h-dvh flex-col gap-4 px-4 py-4">
      {/* top bar: progress + close */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={close}
          aria-label="Zavřít"
          className="rounded-full p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          <X className="size-5" />
        </button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
          <div
            className="h-full rounded-full bg-[#FFD400] transition-all duration-300"
            style={{ width: `${(tippedCount / fights.length) * 100}%` }}
          />
        </div>
        <span className="text-sm font-semibold tabular-nums">
          {tippedCount}/{fights.length}
        </span>
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col gap-4 transition-all duration-300",
          leaving ? "-translate-x-6 opacity-0" : "translate-x-0 opacity-100"
        )}
      >
        {/* fight header */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {fight.weight_class && <Badge variant="secondary">{weightClassLabel(fight.weight_class)}</Badge>}
          {fight.is_title_fight && <Badge variant="accent">Titulový zápas</Badge>}
          {fight.is_main_event && <Badge variant="default">Main event</Badge>}
        </div>

        {/* fighters, tap to pick */}
        <div className="grid grid-cols-2 gap-3">
          {[fight.fighter_a, fight.fighter_b].map((fighter: Fighter) => (
            <button
              key={fighter.id}
              type="button"
              onClick={() => update({ winnerId: fighter.id })}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors",
                tip.winnerId === fighter.id
                  ? "border-[#FFD400] bg-[#FFD400]/10"
                  : "border-white/45 bg-white/35 backdrop-blur-lg hover:border-neutral-400 dark:border-neutral-700/45 dark:bg-neutral-800/35"
              )}
            >
              <FighterPortrait
                name={fighter.name}
                photoUrl={fighter.photo_url ?? fighter.fight_card_photo_url}
                className={cn(tip.winnerId === fighter.id && "ring-2 ring-inset ring-[#FFD400]")}
              />
              <span className="flex items-center gap-1.5 text-center text-base font-bold leading-tight">
                {fighter.flag_code && (
                  <Image
                    src={`https://flagcdn.com/h20/${fighter.flag_code}.png`}
                    alt={fighter.nationality ?? ""}
                    width={16}
                    height={11}
                    unoptimized
                    className="h-auto w-4"
                  />
                )}
                {fighter.name}
              </span>
              {tip.winnerId === fighter.id && (
                <span className="flex items-center gap-1 text-xs font-semibold text-yellow-700 dark:text-[#FFD400]">
                  <Check className="size-3.5" strokeWidth={3} />
                  Tvůj tip
                </span>
              )}
            </button>
          ))}
        </div>

        {/* tale of the tape */}
        <div className="flex flex-col gap-1 rounded-xl border border-white/45 bg-white/35 p-3 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35">
          <TaleOfTheTapeRow label="Rekord" a={fight.fighter_a.record} b={fight.fighter_b.record} />
          <TaleOfTheTapeRow
            label="Kurz"
            a={fight.odds_fighter_a != null ? fight.odds_fighter_a.toFixed(2) : null}
            b={fight.odds_fighter_b != null ? fight.odds_fighter_b.toFixed(2) : null}
          />
          <TaleOfTheTapeRow
            label="Výška"
            a={fight.fighter_a.height_cm ? `${fight.fighter_a.height_cm} cm` : null}
            b={fight.fighter_b.height_cm ? `${fight.fighter_b.height_cm} cm` : null}
          />
          <TaleOfTheTapeRow
            label="Věk"
            a={fight.fighter_a.birth_date ? `${ageFromBirthDate(fight.fighter_a.birth_date)}` : null}
            b={fight.fighter_b.birth_date ? `${ageFromBirthDate(fight.fighter_b.birth_date)}` : null}
          />
          <TaleOfTheTapeRow label="Rank" a={fight.fighter_a.oktagon_rank} b={fight.fighter_b.oktagon_rank} />
        </div>

        {/* method + round */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap justify-center gap-2">
            {(Object.keys(METHOD_LABELS) as Method[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => update({ method: m })}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium",
                  tip.method === m
                    ? "border border-[#FFD400] bg-[#FFD400] text-black"
                    : GLASS_PILL
                )}
              >
                {METHOD_LABELS[m]}
              </button>
            ))}
          </div>
          {tip.method && tip.method !== "DECISION" && (
            <div className="flex flex-wrap justify-center gap-2">
              {Array.from({ length: fight.rounds }, (_, i) => i + 1).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => update({ round: r })}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium",
                    tip.round === r
                      ? "border border-[#FFD400] bg-[#FFD400] text-black"
                      : GLASS_PILL
                  )}
                >
                  {r}. kolo
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-center text-sm text-red-600">{error}</p>}
      </div>

      {/* bottom nav */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className={cn(GLASS_PILL, "flex items-center gap-1 px-4 py-2 text-sm font-medium disabled:opacity-40")}
        >
          <ArrowLeft className="size-4" />
          Předchozí
        </button>
        {done ? (
          <button
            type="button"
            onClick={close}
            className="flex items-center gap-1 rounded-full border border-[#FFD400] bg-[#FFD400] px-4 py-2 text-sm font-semibold text-black"
          >
            <Check className="size-4" strokeWidth={3} />
            Máš tipnuto vše
          </button>
        ) : (
          <button
            type="button"
            disabled={index >= fights.length - 1}
            onClick={() => setIndex((i) => Math.min(fights.length - 1, i + 1))}
            className={cn(GLASS_PILL, "flex items-center gap-1 px-4 py-2 text-sm font-medium disabled:opacity-40")}
          >
            Další
            <ArrowRight className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
