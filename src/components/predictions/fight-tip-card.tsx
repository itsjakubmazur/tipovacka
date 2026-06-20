"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { FighterPortrait } from "@/components/fighter-portrait";
import { Badge } from "@/components/ui/badge";
import { ageFromBirthDate, cn } from "@/lib/utils";
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
        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        active
          ? "border-[#FFD400] bg-[#FFD400] text-black"
          : "border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400"
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
  consensus?: { fighterACount: number; fighterBCount: number; total: number };
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
  }

  const voided = fight.status === "cancelled" || fight.status === "no_contest";
  const effectiveLocked = locked || voided;

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
  }

  const showResult = fight.status === "completed";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border",
        voided ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40" : "border-neutral-200 dark:border-neutral-800"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {fight.weight_class && <Badge variant="secondary">{weightClassLabel(fight.weight_class)}</Badge>}
          {fight.is_title_fight && <Badge variant="accent">Titulový zápas</Badge>}
          {fight.is_main_event && <Badge variant="default">Main event</Badge>}
          {voided && <Badge variant="outline">Zrušeno / NC</Badge>}
          {showResult && (
            <Badge variant="outline">
              Výsledek: {fight.winner_fighter_id === fight.fighter_a.id ? fight.fighter_a.name : fight.fighter_b.name} ·{" "}
              {fight.method ? METHOD_LABELS[fight.method] : ""}
              {fight.result_round ? ` · ${fight.result_round}. kolo` : ""}
              {fight.result_time ? ` · ${fight.result_time}` : ""}
            </Badge>
          )}
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
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
              )}
            >
              <FighterPortrait
                name={fighter.name}
                photoUrl={fighter.photo_url ?? fighter.fight_card_photo_url}
                className={cn(
                  winnerId === fighter.id && "ring-2 ring-inset ring-[#FFD400]",
                  grayedOut && "grayscale"
                )}
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
              {fighter.record && (
                <span className="text-xs text-neutral-500 dark:text-neutral-300">{fighter.record}</span>
              )}
              <RankBadge fighter={fighter} />
              {consensus && (
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-300">
                  {Math.round(
                    ((fighter.id === fight.fighter_a.id
                      ? consensus.fighterACount
                      : consensus.fighterBCount) /
                      consensus.total) *
                      100
                  )}
                  % tipů
                </span>
              )}
            </button>
            <FighterDetails fighter={fighter} />
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
