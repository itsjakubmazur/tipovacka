"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { FighterPortrait } from "@/components/fighter-portrait";
import { Badge } from "@/components/ui/badge";
import { ageFromBirthDate, cn } from "@/lib/utils";
import { GLASS_PILL } from "@/lib/pills";
import { weightClassLabel } from "@/lib/weight-classes";
import { METHOD_LABELS } from "@/lib/method-labels";
import { X, ArrowUp, ArrowDown, ChevronDown } from "lucide-react";
import type { Fight, Fighter, Method, Prediction } from "@/lib/types";

function Pill({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60",
        active ? "border border-[#FFD400] bg-[#FFD400] text-black transition-colors" : GLASS_PILL
      )}
    >
      {children}
    </button>
  );
}

function RankBadge({ fighter }: { fighter: Fighter }) {
  if (!fighter.oktagon_rank) return null;
  return (
    <span className="flex items-center gap-0.5 text-xs text-neutral-500 dark:text-neutral-300">
      {fighter.oktagon_rank}
      {fighter.oktagon_rank_change != null && fighter.oktagon_rank_change !== 0 && (
        <span className={cn("flex items-center", fighter.oktagon_rank_change > 0 ? "text-green-600" : "text-red-600")}>
          {fighter.oktagon_rank_change > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
        </span>
      )}
    </span>
  );
}

function tipsWord(n: number): string {
  if (n === 1) return "tip";
  if (n >= 2 && n <= 4) return "tipy";
  return "tipů";
}

/** Collapsed consensus - "73 % · 4 tipy" - expanding to the actual
 * nicknames on tap, so the names list doesn't eat two lines under every
 * fighter on a 14-fight card. */
function ConsensusChip({ names, total }: { names: string[]; total: number }) {
  const [open, setOpen] = useState(false);
  if (names.length === 0 || total === 0) return null;

  return (
    <div className="flex w-full flex-col items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-0.5 text-[11px] font-medium text-neutral-500 underline-offset-2 hover:underline dark:text-neutral-300"
      >
        {Math.round((names.length / total) * 100)} % · {names.length} {tipsWord(names.length)}
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <span className="max-w-[11rem] text-[11px] leading-snug text-neutral-400 dark:text-neutral-500">
          {names.join(", ")}
        </span>
      )}
    </div>
  );
}

function FighterDetails({ fighter }: { fighter: Fighter }) {
  const [bioOpen, setBioOpen] = useState(false);

  return (
    <div className="flex w-full flex-col items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {(fighter.weight_kg || fighter.height_cm || fighter.birth_date) && (
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          {[
            fighter.weight_kg && `${fighter.weight_kg} kg`,
            fighter.height_cm && `${fighter.height_cm} cm`,
            fighter.birth_date && `${ageFromBirthDate(fighter.birth_date)} let`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      )}
      {fighter.bio && (
        <button
          type="button"
          onClick={() => setBioOpen((v) => !v)}
          className="flex items-center gap-0.5 text-xs font-medium text-neutral-500 underline-offset-2 hover:underline dark:text-neutral-300"
        >
          O zápasníkovi
          <ChevronDown className={cn("size-3 transition-transform", bioOpen && "rotate-180")} />
        </button>
      )}
      {bioOpen && fighter.bio && (
        <p className="px-1 text-left text-xs text-neutral-600 dark:text-neutral-400">{fighter.bio}</p>
      )}
    </div>
  );
}

export function FightTipCard({
  fight,
  userId,
  initialPrediction,
  locked,
  consensus,
}: {
  fight: Fight;
  userId: string;
  initialPrediction: Prediction | null;
  locked: boolean;
  consensus?: { fighterANames: string[]; fighterBNames: string[] };
}) {
  const supabase = createClient();

  const [winnerId, setWinnerId] = useState<string | null>(
    initialPrediction?.predicted_winner_id ?? null
  );
  const [method, setMethod] = useState<Method | null>(
    initialPrediction?.predicted_method ?? null
  );
  const [round, setRound] = useState<number | null>(
    initialPrediction?.predicted_round ?? null
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persist(next: {
    winnerId: string | null;
    method: Method | null;
    round: number | null;
  }) {
    if (!next.winnerId || !next.method) return;
    if (next.method !== "DECISION" && next.round === null) return;

    setSaving(true);
    setError(null);
    const { error } = await supabase.from("predictions").upsert(
      {
        user_id: userId,
        fight_id: fight.id,
        predicted_winner_id: next.winnerId,
        predicted_method: next.method,
        predicted_round: next.method === "DECISION" ? null : next.round,
      },
      { onConflict: "user_id,fight_id" }
    );
    setSaving(false);
    if (error) {
      setError("Uložení se nepodařilo.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    window.dispatchEvent(
      new CustomEvent("tip-state-changed", { detail: { fightId: fight.id, tipped: true } })
    );
  }

  const voided = fight.status === "cancelled" || fight.status === "no_contest";
  const hasTba = fight.fighter_a.is_tba || fight.fighter_b.is_tba;
  const effectiveLocked = locked || voided || hasTba;

  function selectWinner(id: string) {
    if (effectiveLocked) return;
    setWinnerId(id);
    persist({ winnerId: id, method, round });
  }

  function selectMethod(m: Method) {
    if (effectiveLocked) return;
    setMethod(m);
    const nextRound = m === "DECISION" ? null : round;
    setRound(nextRound);
    persist({ winnerId, method: m, round: nextRound });
  }

  function selectRound(r: number) {
    if (effectiveLocked) return;
    setRound(r);
    persist({ winnerId, method, round: r });
  }

  async function clearTip() {
    if (effectiveLocked) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("predictions")
      .delete()
      .eq("user_id", userId)
      .eq("fight_id", fight.id);
    setSaving(false);
    if (error) {
      setError("Smazání se nepodařilo.");
      return;
    }
    setWinnerId(null);
    setMethod(null);
    setRound(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    window.dispatchEvent(
      new CustomEvent("tip-state-changed", { detail: { fightId: fight.id, tipped: false } })
    );
  }

  const showResult = fight.status === "completed";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border shadow-lg shadow-black/20 transition-shadow hover:shadow-xl dark:shadow-black/60",
        voided
          ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40"
          : "border-white/45 bg-white/35 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {fight.weight_class && <Badge variant="secondary">{weightClassLabel(fight.weight_class)}</Badge>}
          {fight.is_title_fight && <Badge variant="accent">Titulový zápas</Badge>}
          {fight.is_main_event && <Badge variant="default">Main event</Badge>}
          {voided && <Badge variant="outline">Zrušeno / NC</Badge>}
          {!voided && hasTba && <Badge variant="outline">Soupeři ještě nejsou známí</Badge>}
          {showResult &&
            (() => {
              // color the result by how the user's own tip did - scanning
              // the card after the gala, green/red tells the story alone
              const graded = initialPrediction?.points != null;
              const hit = graded && initialPrediction!.points! > 0;
              return (
                <Badge
                  variant="outline"
                  className={cn(
                    graded &&
                      (hit
                        ? "border-green-600/50 bg-green-600/15 text-green-800 dark:text-green-400"
                        : "border-red-600/50 bg-red-600/15 text-red-800 dark:text-red-400")
                  )}
                >
                  Výsledek: {fight.winner_fighter_id === fight.fighter_a.id ? fight.fighter_a.name : fight.fighter_b.name} ·{" "}
                  {fight.method ? METHOD_LABELS[fight.method] : ""}
                  {fight.result_round ? ` · ${fight.result_round}. kolo` : ""}
                  {fight.result_time ? ` · ${fight.result_time}` : ""}
                  {graded ? ` · ${hit ? `+${initialPrediction!.points} b.` : "0 b."}` : ""}
                </Badge>
              );
            })()}
        </div>
        {!effectiveLocked && winnerId && (
          <button
            type="button"
            onClick={clearTip}
            className="flex items-center gap-1 text-xs font-medium text-neutral-500 dark:text-neutral-300 hover:text-red-600"
          >
            <X className="size-3.5" />
            Smazat tip
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 divide-x divide-neutral-200 border-t border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {[fight.fighter_a, fight.fighter_b].map((fighter) => {
          const isActualWinner = showResult && fight.winner_fighter_id === fighter.id;
          const isActualLoser = showResult && fight.winner_fighter_id !== fighter.id;
          const grayedOut = isActualLoser || fight.status === "no_contest";
          return (
          <div key={fighter.id} className="flex flex-col items-center gap-1.5 px-2 pb-3 text-center">
            <button
              type="button"
              disabled={effectiveLocked}
              onClick={() => selectWinner(fighter.id)}
              className={cn(
                "flex w-full flex-col items-center gap-1.5 pt-0 transition-colors disabled:cursor-not-allowed",
                winnerId === fighter.id
                  ? "bg-[#FFD400]/10"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-700/40"
              )}
            >
              <FighterPortrait
                name={fighter.name}
                photoUrl={fighter.photo_url ?? fighter.fight_card_photo_url}
                isTba={fighter.is_tba}
                grayedOut={grayedOut}
                className={cn(winnerId === fighter.id && "ring-2 ring-inset ring-[#FFD400]")}
              />
              {isActualWinner && (
                <Badge variant="accent" className="mt-1">
                  Výhra
                </Badge>
              )}
              <span className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold">
                {fighter.flag_code && (
                  <Image
                    src={`https://flagcdn.com/h20/${fighter.flag_code}.png`}
                    alt={fighter.nationality ?? ""}
                    title={fighter.nationality ?? undefined}
                    width={16}
                    height={11}
                    unoptimized
                    className="h-auto w-4"
                  />
                )}
                {fighter.name}
              </span>
              {/* record · rank · odds on one row - vertical space is scarce
                  with 14 fights on the card */}
              {!fighter.is_tba ? (
                <>
                  <span className="flex flex-wrap items-center justify-center gap-x-1.5 text-xs text-neutral-500 dark:text-neutral-300">
                    {fighter.record && <span>{fighter.record}</span>}
                    {fighter.record && fighter.oktagon_rank && <span aria-hidden>·</span>}
                    <RankBadge fighter={fighter} />
                    {(() => {
                      const odds =
                        fighter.id === fight.fighter_a.id ? fight.odds_fighter_a : fight.odds_fighter_b;
                      if (odds == null) return null;
                      return (
                        <>
                          {(fighter.record || fighter.oktagon_rank) && <span aria-hidden>·</span>}
                          <span className="font-medium">kurz {odds.toFixed(2)}</span>
                        </>
                      );
                    })()}
                  </span>
                </>
              ) : (
                fighter.record && (
                  <span className="text-xs text-neutral-500 dark:text-neutral-300">{fighter.record}</span>
                )
              )}
            </button>
            {!fighter.is_tba && consensus && (
              <ConsensusChip
                names={fighter.id === fight.fighter_a.id ? consensus.fighterANames : consensus.fighterBNames}
                total={consensus.fighterANames.length + consensus.fighterBNames.length}
              />
            )}
            {!fighter.is_tba && <FighterDetails fighter={fighter} />}
          </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 p-4 pt-4">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-300">Způsob</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(METHOD_LABELS) as Method[]).map((m) => (
              <Pill key={m} active={method === m} disabled={effectiveLocked} onClick={() => selectMethod(m)}>
                {METHOD_LABELS[m]}
              </Pill>
            ))}
          </div>
        </div>

        {method === "DECISION" ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Tip: zápas dojde do konce, na body.</p>
        ) : (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-300">Kolo</p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: fight.rounds }, (_, i) => i + 1).map((r) => (
                <Pill key={r} active={round === r} disabled={effectiveLocked} onClick={() => selectRound(r)}>
                  {r}.
                </Pill>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-3 h-4 text-xs text-neutral-500 dark:text-neutral-300">
        {voided && winnerId
          ? "Zápas se nekoná, tip se nezapočítá."
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
