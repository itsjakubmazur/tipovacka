"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { FighterPortrait } from "@/components/fighter-portrait";
import { Badge } from "@/components/ui/badge";
import { ageFromBirthDate, cn } from "@/lib/utils";
import { GLASS_PILL } from "@/lib/pills";
import { weightClassLabel } from "@/lib/weight-classes";
import { METHOD_LABELS } from "@/lib/method-labels";
import { X, ArrowUp, ArrowDown, ChevronDown, Star, HelpCircle, Check, TriangleAlert } from "lucide-react";
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
        active ? "border border-accent bg-accent text-black transition-colors" : GLASS_PILL
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
        <span className={cn("flex items-center", fighter.oktagon_rank_change > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
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
  eventId,
  initialPrediction,
  initialIsBold,
  locked,
  consensus,
}: {
  fight: Fight;
  userId: string;
  eventId?: string;
  initialPrediction: Prediction | null;
  initialIsBold?: boolean;
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
  const [isBold, setIsBold] = useState(initialIsBold ?? false);
  const [boldHelpOpen, setBoldHelpOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // only one bold pick per event - when another card takes it, this
  // one has to visually let go without a server roundtrip
  useEffect(() => {
    function onBoldChanged(e: Event) {
      const detail = (e as CustomEvent<{ fightId: string | null }>).detail;
      setIsBold(detail.fightId === fight.id);
    }
    window.addEventListener("bold-state-changed", onBoldChanged);
    return () => window.removeEventListener("bold-state-changed", onBoldChanged);
  }, [fight.id]);

  async function toggleBold() {
    if (effectiveLocked || !eventId) return;
    setError(null);
    if (isBold) {
      const { error } = await supabase
        .from("bold_picks")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", userId);
      if (error) {
        setError("Uložení jistotky se nepodařilo.");
        return;
      }
      window.dispatchEvent(
        new CustomEvent("bold-state-changed", { detail: { fightId: null } })
      );
    } else {
      const { error } = await supabase
        .from("bold_picks")
        .upsert(
          { event_id: eventId, user_id: userId, fight_id: fight.id },
          { onConflict: "event_id,user_id" }
        );
      if (error) {
        setError("Uložení jistotky se nepodařilo.");
        return;
      }
      window.dispatchEvent(
        new CustomEvent("bold-state-changed", { detail: { fightId: fight.id } })
      );
    }
  }

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

  // A pick only counts once winner + method (+ round unless decision) are
  // all set - until then nothing is saved. Surface that clearly so a
  // half-finished pick never *looks* done.
  const tipComplete = Boolean(winnerId) && Boolean(method) && (method === "DECISION" || round !== null);
  const tipInProgress = !effectiveLocked && Boolean(winnerId) && !tipComplete;

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
    // a bold pick on an untipped fight would double nothing - drop it
    if (isBold && eventId) {
      await supabase.from("bold_picks").delete().eq("event_id", eventId).eq("user_id", userId);
      window.dispatchEvent(
        new CustomEvent("bold-state-changed", { detail: { fightId: null } })
      );
    }
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
          {effectiveLocked && isBold && (
            <Badge variant="accent" className="gap-1">
              <Star className="size-3" fill="currentColor" />
              Jistotka ×2
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!effectiveLocked && eventId && winnerId && (
            <div className="relative flex items-center gap-1">
              <button
                type="button"
                onClick={toggleBold}
                className={cn(
                  "flex items-center gap-1 text-xs font-medium transition-colors",
                  isBold
                    ? "text-yellow-600 dark:text-accent"
                    : "text-neutral-500 hover:text-yellow-600 dark:text-neutral-300 dark:hover:text-accent"
                )}
              >
                <Star className="size-3.5" fill={isBold ? "currentColor" : "none"} />
                {isBold ? "Jistotka ×2" : "Dát jistotku"}
              </button>
              <button
                type="button"
                onClick={() => setBoldHelpOpen((v) => !v)}
                aria-label="Co je jistotka?"
                className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
              >
                <HelpCircle className="size-3.5" />
              </button>
              {boldHelpOpen && (
                <>
                  <button
                    type="button"
                    aria-hidden
                    tabIndex={-1}
                    onClick={() => setBoldHelpOpen(false)}
                    className="fixed inset-0 z-10 cursor-default"
                  />
                  <div className="absolute left-0 top-full z-20 mt-1.5 w-60 max-w-[calc(100vw-2rem)] rounded-xl border border-neutral-200 bg-white p-3 text-xs leading-relaxed text-neutral-600 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                    <span className="font-semibold text-neutral-800 dark:text-neutral-100">Jistotka:</span>{" "}
                    jeden zápas na galavečer si můžeš označit hvězdičkou a body z něj se ti počítají
                    dvakrát. Dej ji tam, kde si nejvíc věříš.
                  </div>
                </>
              )}
            </div>
          )}
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
      </div>

      {showResult &&
        (() => {
          // Its own full-width row under the header - the result is the
          // headline once a fight is graded, not another chip in the cluster.
          // Color it by how the user's own tip did: green/red tells the story
          // when scanning the card after the gala.
          const graded = initialPrediction?.points != null;
          const hit = graded && initialPrediction!.points! > 0;
          const winnerName =
            fight.winner_fighter_id === fight.fighter_a.id ? fight.fighter_a.name : fight.fighter_b.name;
          return (
            <div
              className={cn(
                "flex flex-wrap items-center gap-x-2 gap-y-1 border-t px-4 py-2.5 text-sm",
                graded
                  ? hit
                    ? "border-green-600/30 bg-green-600/10 text-green-800 dark:text-green-400"
                    : "border-red-600/30 bg-red-600/10 text-red-800 dark:text-red-400"
                  : "border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300"
              )}
            >
              <span className="text-xs font-semibold uppercase tracking-wide opacity-70">Výsledek</span>
              <span className="font-semibold">{winnerName}</span>
              <span className="opacity-80">
                {fight.method ? METHOD_LABELS[fight.method] : ""}
                {fight.result_round ? ` · ${fight.result_round}. kolo` : ""}
                {fight.result_time ? ` · ${fight.result_time}` : ""}
              </span>
              {graded && (
                <span className="ml-auto font-bold tabular-nums">
                  {hit ? `+${initialPrediction!.points}${isBold ? "×2" : ""} b.` : "0 b."}
                </span>
              )}
            </div>
          );
        })()}

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
                  ? "bg-accent/10"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-700/40"
              )}
            >
              <FighterPortrait
                name={fighter.name}
                photoUrl={fighter.photo_url ?? fighter.fight_card_photo_url}
                isTba={fighter.is_tba}
                grayedOut={grayedOut}
                className={cn(winnerId === fighter.id && "ring-2 ring-inset ring-accent")}
              />
              {isActualWinner && (
                <Badge variant="accent" className="mt-1">
                  Výherce
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
              {fighter.nickname && (
                <span className="-mt-1 text-xs italic text-neutral-400 dark:text-neutral-500">
                  „{fighter.nickname}“
                </span>
              )}
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
          <p
            className={cn(
              "mb-1.5 text-xs font-medium uppercase",
              tipInProgress && !method
                ? "text-yellow-700 dark:text-accent"
                : "text-neutral-500 dark:text-neutral-300"
            )}
          >
            Způsob
          </p>
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
            <p
              className={cn(
                "mb-1.5 text-xs font-medium uppercase",
                tipInProgress && round === null
                  ? "text-yellow-700 dark:text-accent"
                  : "text-neutral-500 dark:text-neutral-300"
              )}
            >
              Kolo
            </p>
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

      <div className="min-h-4 px-4 pb-3 text-xs">
        {error ? (
          <span className="text-red-600 dark:text-red-400">{error}</span>
        ) : voided && winnerId ? (
          <span className="text-neutral-500 dark:text-neutral-300">Zápas se nekoná, tip se nezapočítá.</span>
        ) : tipInProgress ? (
          <span className="flex items-center gap-1 font-medium text-yellow-700 dark:text-accent">
            <TriangleAlert className="size-3.5 shrink-0" />
            {method && method !== "DECISION" && round === null
              ? "Vyber ještě kolo, jinak se tip neuloží."
              : "Vyber ještě způsob ukončení, jinak se tip neuloží."}
          </span>
        ) : saving ? (
          <span className="text-neutral-500 dark:text-neutral-300">Ukládám…</span>
        ) : saved ? (
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <Check className="size-3.5 shrink-0" />
            Uloženo.
          </span>
        ) : null}
      </div>
    </div>
  );
}
