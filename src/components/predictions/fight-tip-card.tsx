"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { FighterAvatar } from "@/components/fighter-avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { weightClassLabel } from "@/lib/weight-classes";
import { METHOD_LABELS } from "@/lib/method-labels";
import { X } from "lucide-react";
import type { Fight, Method, Prediction } from "@/lib/types";

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
          : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400"
      )}
    >
      {children}
    </button>
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
        "rounded-xl border p-4",
        voided ? "border-red-200 bg-red-50" : "border-neutral-200"
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
            </Badge>
          )}
        </div>
        {!effectiveLocked && winnerId && (
          <button
            type="button"
            onClick={clearTip}
            className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-red-600"
          >
            <X className="size-3.5" />
            Smazat tip
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[fight.fighter_a, fight.fighter_b].map((fighter) => (
          <button
            key={fighter.id}
            type="button"
            disabled={effectiveLocked}
            onClick={() => selectWinner(fighter.id)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors disabled:cursor-not-allowed",
              winnerId === fighter.id
                ? "border-[#FFD400] bg-[#FFD400]/10"
                : "border-neutral-200 hover:border-neutral-300"
            )}
          >
            <FighterAvatar name={fighter.name} photoUrl={fighter.photo_url} />
            <span className="flex items-center gap-1.5 text-sm font-semibold">
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
              <span className="text-xs text-neutral-500">{fighter.record}</span>
            )}
            {fighter.fightmatrix_rank && (
              <span className="text-xs text-neutral-500">
                {fighter.fightmatrix_rank}
                {fighter.fightmatrix_score != null && ` · ${fighter.fightmatrix_score} b.`}
              </span>
            )}
            {consensus && (
              <span className="text-xs font-medium text-neutral-500">
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
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase text-neutral-500">Způsob</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(METHOD_LABELS) as Method[]).map((m) => (
              <Pill key={m} active={method === m} disabled={effectiveLocked} onClick={() => selectMethod(m)}>
                {METHOD_LABELS[m]}
              </Pill>
            ))}
          </div>
        </div>

        {method === "DECISION" ? (
          <p className="text-sm text-neutral-600">Tip: zápas dojde do konce, na body.</p>
        ) : (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase text-neutral-500">Kolo</p>
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

      <div className="mt-3 h-4 text-xs text-neutral-500">
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
