"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { FightMatchup } from "@/components/predictions/fight-matchup";
import { cn } from "@/lib/utils";
import { GLASS_PILL } from "@/lib/pills";
import { Reveal } from "@/components/ui/reveal";
import { METHOD_LABELS } from "@/lib/method-labels";
import { pointsLabel, scoreBreakdown } from "@/lib/score-breakdown";
import { X, ChevronDown, Star, HelpCircle, Check, TriangleAlert } from "lucide-react";
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
        // the press is the whole feedback loop for tipping - let the pill give
        "rounded-full px-3 py-1.5 text-sm font-medium transition-transform duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100",
        active ? "border border-accent bg-accent text-black transition-colors" : GLASS_PILL
      )}
    >
      {children}
    </button>
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
function ConsensusChip({
  names,
  total,
  label,
  align = "left",
}: {
  names: string[];
  total: number;
  /** whose share this is - the chips sit side by side now, one per fighter */
  label: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  if (names.length === 0 || total === 0) return null;

  return (
    <div
      className={cn("flex min-w-0 flex-col gap-0.5", align === "right" ? "items-end" : "items-start")}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-0.5 text-[11px] font-medium text-neutral-500 underline-offset-2 hover:underline dark:text-neutral-300"
      >
        <span className="truncate">{label.split(" ").pop()}</span>
        <span className="whitespace-nowrap">
          {" "}
          {Math.round((names.length / total) * 100)} % · {names.length} {tipsWord(names.length)}
        </span>
        <ChevronDown
          className={cn(
            "size-3 shrink-0 transition-transform duration-500 ease-out motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </button>
      <Reveal open={open}>
        <span
          className={cn(
            "block max-w-[11rem] text-[11px] leading-snug text-neutral-400 dark:text-neutral-500",
            align === "right" && "text-right"
          )}
        >
          {names.join(", ")}
        </span>
      </Reveal>
    </div>
  );
}

// No gender on the fighters table (the OKTAGON API doesn't send one), so the
// heading is inferred from the names. Czech/Slovak/Polish feminine surnames
// are a reliable enough tell for this promotion's roster; anything else falls
// back to the generic plural.
const FEMININE_SUFFIXES = ["ová", "cká", "ská", "ná", "wska", "ska"];

function looksFeminine(name: string): boolean {
  const surname = name.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
  return FEMININE_SUFFIXES.some((suffix) => surname.endsWith(suffix));
}

export function FightTipCard({
  fight,
  userId,
  eventId,
  initialPrediction,
  initialIsBold,
  locked,
  consensus,
  revealIndex = 0,
}: {
  fight: Fight;
  userId: string;
  eventId?: string;
  initialPrediction: Prediction | null;
  initialIsBold?: boolean;
  locked: boolean;
  consensus?: { fighterANames: string[]; fighterBNames: string[] };
  /** position on the card - the graded result bars wipe in one after another
   * down the page, so coming back mid-gala reads as a sequence of results
   * rather than a wall of green and red */
  revealIndex?: number;
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
  const [biosOpen, setBiosOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(false);
  const [saved, setSaved] = useState(false);
  // "when did I last touch this tip" - the question everyone asks themselves
  // in the last hour before lock. Server value first, then whatever we just saved.
  const [savedAt, setSavedAt] = useState<string | null>(initialPrediction?.updated_at ?? null);
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
    // the tip is in - pulse the card so it's felt, not just read
    setFlash(true);
    setTimeout(() => setFlash(false), 700);
    setSaved(true);
    setSavedAt(new Date().toISOString());
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
  const graded = initialPrediction?.points != null;
  const hit = graded && initialPrediction!.points! > 0;

  const fighterA = fight.fighter_a;
  const fighterB = fight.fighter_b;
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border shadow-lg shadow-black/20 transition-shadow hover:shadow-xl dark:shadow-black/60",
        flash && "animate-tip-saved",
        // the ring outlasts the pulse, so "it's in" is still readable a second
        // later when you look back up from the pills
        saved && "ring-2 ring-green-500/40",
        voided
          ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40"
          : "border-white/45 bg-white/35 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35"
      )}
    >
      {/* One header row, not two. Main event and jistotka sit at opposite ends;
          the weight class moved down to sit over the names, where it labels
          the matchup instead of floating among unrelated chips. */}
      <div className="flex min-h-[2.75rem] items-center justify-between gap-2 border-b border-black/5 px-3 py-2 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-1.5">
          {fight.is_main_event && fight.is_title_fight ? (
            <Badge variant="accent">Main event · titul</Badge>
          ) : fight.is_title_fight ? (
            <Badge variant="accent">Titulový zápas</Badge>
          ) : fight.is_main_event ? (
            <Badge variant="default">Main event</Badge>
          ) : null}
          {voided && <Badge variant="outline">Zrušeno / NC</Badge>}
          {!voided && hasTba && <Badge variant="outline">Soupeři ještě nejsou známí</Badge>}
        </div>

        {effectiveLocked ? (
          isBold ? (
            <Badge variant="accent" className="gap-1">
              <Star className="size-3" fill="currentColor" />
              Jistotka ×2
            </Badge>
          ) : null
        ) : eventId && winnerId ? (
          <div className="relative flex shrink-0 items-center gap-1">
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
                <div className="absolute right-0 top-full z-20 mt-1.5 w-60 max-w-[calc(100vw-2rem)] rounded-xl border border-neutral-200 bg-white p-3 text-xs leading-relaxed text-neutral-600 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-100">Jistotka:</span>{" "}
                  jeden zápas na galavečer si můžeš označit hvězdičkou a body z něj se ti počítají
                  dvakrát. Dej ji tam, kde si nejvíc věříš.
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* The result as three labelled columns. As one run-on line - "Mudroch ·
          Rozhodnutí · 3. kolo · 05:00" - it was a sentence you had to read;
          this you take in at a glance. */}
      {showResult && (
        <div
          style={{ animationDelay: `${Math.min(revealIndex, 8) * 90}ms` }}
          className="animate-result-in grid grid-cols-3 border-b border-black/5 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03]"
        >
          {[
            { k: "Čas", v: fight.result_time ?? "—" },
            { k: "Kolo", v: fight.result_round ? String(fight.result_round) : "—" },
            { k: "Ukončení", v: fight.method ? METHOD_LABELS[fight.method] : "—" },
          ].map((cell, i) => (
            <div
              key={cell.k}
              className={cn(
                "px-2 py-2 text-center",
                i > 0 && "border-l border-black/5 dark:border-white/10"
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {cell.k}
              </p>
              <p className="text-sm font-bold tabular-nums">{cell.v}</p>
            </div>
          ))}
        </div>
      )}

      <FightMatchup
        fight={fight}
        onPick={effectiveLocked ? undefined : selectWinner}
        highlight={winnerId ? [{ fighterId: winnerId, tone: "accent" }] : undefined}
        tags={[
          ...(showResult && fight.winner_fighter_id
            ? [{ fighterId: fight.winner_fighter_id, label: "Vítěz", tone: "green" as const }]
            : []),
          ...(winnerId
            ? [
                {
                  fighterId: winnerId,
                  label: isBold ? "★ Jistotka ×2" : "Tvůj tip",
                  tone: "accent" as const,
                },
              ]
            : []),
        ]}
      />

      {!effectiveLocked && !winnerId && (
        <p className="px-4 pb-1 text-center text-xs text-neutral-500 dark:text-neutral-400">
          Ťukni na zápasníka, na kterého sázíš
        </p>
      )}

      {graded && (
        <div
          style={{ animationDelay: `${Math.min(revealIndex, 8) * 90}ms` }}
          className={cn(
            "animate-result-in flex items-center gap-2 border-y px-4 py-2 text-sm font-semibold",
            hit
              ? "border-green-600/30 bg-green-600/10 text-green-800 dark:text-green-400"
              : "border-red-600/30 bg-red-600/10 text-red-800 dark:text-red-400"
          )}
        >
          <span className="min-w-0 flex-1 truncate">{scoreBreakdown(fight, initialPrediction)}</span>
          <span className="shrink-0 tabular-nums">
            {pointsLabel(initialPrediction?.points, isBold)}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3 px-4 pb-3 pt-3">
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

        {/* The round block only appears once a method is picked. You cannot
            choose a round before a method anyway, and on an untipped card it
            was five pills of dead weight - which is most cards before lock.
            That space now belongs to the photos. */}
        {method === "DECISION" ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Tip: zápas dojde do konce, na body.</p>
        ) : method ? (
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
        ) : null}

        {!effectiveLocked && winnerId && (
          <button
            type="button"
            onClick={clearTip}
            className="flex items-center gap-1 self-start text-xs font-medium text-neutral-500 hover:text-red-600 dark:text-neutral-300"
          >
            <X className="size-3.5" />
            Smazat tip
          </button>
        )}
      </div>

      {consensus && (consensus.fighterANames.length > 0 || consensus.fighterBNames.length > 0) && (
        <div className="flex items-start justify-between gap-3 border-t border-black/5 px-4 py-2 dark:border-white/10">
          <ConsensusChip
            names={consensus.fighterANames}
            total={consensus.fighterANames.length + consensus.fighterBNames.length}
            label={fighterA.name}
          />
          <ConsensusChip
            names={consensus.fighterBNames}
            total={consensus.fighterANames.length + consensus.fighterBNames.length}
            label={fighterB.name}
            align="right"
          />
        </div>
      )}

      {(() => {
        const withBio = [fighterA, fighterB].filter((f) => !f.is_tba && f.bio);
        if (withBio.length === 0) return null;
        const women = [fighterA, fighterB].some((f) => looksFeminine(f.name));
        const label = women ? "O zápasnicích" : "O zápasnících";
        return (
          <div className="border-t border-black/5 dark:border-white/10">
            <button
              type="button"
              onClick={() => setBiosOpen((v) => !v)}
              aria-expanded={biosOpen}
              className="flex w-full items-center justify-center gap-1 px-4 py-2 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-300 dark:hover:text-white"
            >
              {label}
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform duration-500 ease-out motion-reduce:transition-none",
                  biosOpen && "rotate-180"
                )}
              />
            </button>
            <Reveal open={biosOpen}>
              <div className="grid gap-4 px-4 pb-3 sm:grid-cols-2">
                {withBio.map((f) => (
                  <div key={f.id}>
                    <p className="mb-1 text-xs font-semibold">{f.name}</p>
                    <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{f.bio}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        );
      })()}

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
            <Check className="animate-tip-check size-3.5 shrink-0" strokeWidth={3} />
            Uloženo.
          </span>
        ) : savedAt && !effectiveLocked ? (
          <span className="text-neutral-400 dark:text-neutral-500">
            Tip uložen{" "}
            {new Date(savedAt).toLocaleString("cs-CZ", {
              day: "numeric",
              month: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/Prague",
            })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
