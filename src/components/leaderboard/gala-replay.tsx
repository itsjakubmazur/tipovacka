"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Zap } from "lucide-react";
import { useFlipList } from "@/lib/use-flip-list";
import { cn } from "@/lib/utils";

// long enough for a row's move to finish and register before the next
// result lands on top of it
const STEP_MS = 2100;

export type ReplayStep = {
  fightId: string;
  label: string;
  result: string;
  /** points each user took from this fight (jistotka already doubled) */
  gains: Record<string, number>;
};

type Standing = { userId: string; nickname: string; points: number; gained: number };

/** Plays a finished gala back fight by fight: the board starts empty and
 * reshuffles as each result lands, so you can watch the night unfold.
 *
 * It runs itself - a full card takes something like half a minute without a
 * single tap - and the chapter strip below doubles as a scrubber for anyone
 * who wants to stop on a particular fight. */
export function GalaReplay({
  steps,
  finalOrder,
  currentUserId,
}: {
  steps: ReplayStep[];
  /** the true final board, so the last frame matches the real standings
   *  (which include the FOTN and perfect-card bonuses) */
  finalOrder: { userId: string; nickname: string; points: number }[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  // -1 = before the first fight; steps.length = the final board with bonuses
  const [step, setStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastStep = steps.length;

  useEffect(() => {
    // nothing left to advance to - the final frame just sits there
    if (!playing || step >= lastStep) return;
    timer.current = setTimeout(() => {
      setStep(step + 1);
      if (step + 1 >= lastStep) setPlaying(false);
    }, STEP_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, step, lastStep]);

  const standings: Standing[] = useMemo(() => {
    // the closing frame is the real board, bonuses and all
    if (step >= lastStep) {
      return finalOrder.map((r) => ({ ...r, gained: 0 }));
    }
    const totals = new Map<string, number>(finalOrder.map((r) => [r.userId, 0]));
    for (let i = 0; i <= step; i++) {
      for (const [userId, gain] of Object.entries(steps[i].gains)) {
        totals.set(userId, (totals.get(userId) ?? 0) + gain);
      }
    }
    const justNow = step >= 0 ? steps[step].gains : {};
    return finalOrder
      .map((r) => ({
        userId: r.userId,
        nickname: r.nickname,
        points: totals.get(r.userId) ?? 0,
        gained: justNow[r.userId] ?? 0,
      }))
      .sort((a, b) => b.points - a.points || a.nickname.localeCompare(b.nickname, "cs"));
  }, [step, steps, finalOrder, lastStep]);

  const rowRef = useFlipList(standings.map((r) => r.userId));

  function start() {
    setStep(-1);
    setPlaying(true);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          start();
        }}
        className="flex items-center gap-2 self-start rounded-full border border-yellow-600/60 bg-accent/10 px-3.5 py-1.5 text-sm font-semibold transition-colors hover:bg-accent/20 dark:border-accent/40"
      >
        <Play className="size-4 text-yellow-700 dark:text-accent" />
        Přehrát večer
      </button>
    );
  }

  const caption =
    step < 0
      ? "Před prvním zápasem"
      : step >= lastStep
        ? "Konečné pořadí (včetně bonusů)"
        : `${step + 1}. zápas · ${steps[step].label}${steps[step].result ? ` — ${steps[step].result}` : ""}`;

  return (
    <div className="glass-surface flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-sm font-semibold">Jak se to seběhlo</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white"
        >
          Zavřít
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (step >= lastStep ? start() : setPlaying((p) => !p))}
          aria-label={playing ? "Pozastavit" : "Přehrát"}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-black transition-transform active:scale-90"
        >
          {step >= lastStep ? (
            <RotateCcw className="size-4" />
          ) : playing ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
        </button>

        {/* chapter strip - one segment per fight, also a scrubber */}
        <div className="flex flex-1 items-center gap-[3px]">
          {steps.map((s, i) => (
            <button
              key={s.fightId}
              type="button"
              aria-label={`${i + 1}. zápas: ${s.label}`}
              title={s.label}
              onClick={() => {
                setPlaying(false);
                setStep(i);
              }}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i < step
                  ? "bg-yellow-600/60 dark:bg-accent/60"
                  : i === step
                    ? "bg-accent ring-2 ring-accent/30"
                    : "bg-black/10 dark:bg-white/15"
              )}
            />
          ))}
        </div>
      </div>

      <p className="min-h-4 text-xs text-neutral-600 dark:text-neutral-300">{caption}</p>

      <div className="flex flex-col gap-0.5">
        {standings.map((row, i) => (
          <div
            key={row.userId}
            ref={rowRef(row.userId)}
            className={cn(
              "flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors",
              row.gained > 0 && "bg-green-500/15",
              row.userId === currentUserId && "font-semibold ring-1 ring-accent/50"
            )}
          >
            <span className="w-5 shrink-0 text-right text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
              {i + 1}.
            </span>
            <span className="min-w-0 flex-1 truncate">{row.nickname}</span>
            {row.gained > 0 && (
              <span className="flex shrink-0 items-center gap-0.5 text-xs font-bold text-green-600 dark:text-green-400">
                <Zap className="size-3" />+{row.gained}
              </span>
            )}
            <span className="w-7 shrink-0 text-right font-bold tabular-nums">{row.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
