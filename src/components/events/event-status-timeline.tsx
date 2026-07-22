"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/** The gala lifecycle as a single vertical rail: Tipování → Galavečer
 * živě → Vyhodnoceno. The current phase glows OKTAGON yellow (with a
 * live countdown while tipping is open); past phases are muted solid
 * dots, future phases are hollow. Replaces the scattered status lines
 * (read-only notice, standalone countdown, score chip) with one
 * at-a-glance view. Client component so the countdown ticks. */

type StepState = "done" | "current" | "future";

function shortDateTime(iso: string): string {
  return new Date(iso)
    .toLocaleString("cs-CZ", {
      weekday: "short",
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Prague",
    })
    .replace(",", "");
}

function shortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  });
}

function Dot({ state }: { state: StepState }) {
  return (
    <span
      className={cn(
        "mt-1 size-3 shrink-0 rounded-full border-2",
        state === "current" &&
          "border-accent bg-accent shadow-[0_0_0_4px_rgba(255,212,0,0.18)]",
        state === "done" && "border-neutral-400 bg-neutral-400 dark:border-neutral-500 dark:bg-neutral-500",
        state === "future" && "border-neutral-300 bg-transparent dark:border-neutral-600"
      )}
    />
  );
}

function Countdown({ targetIso }: { targetIso: string }) {
  const target = new Date(targetIso).getTime();
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (remaining <= 0) return null;

  const totalSec = Math.floor(remaining / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  // under an hour, urgency kicks in: switch to hh:mm:ss in red
  const urgent = remaining < 3_600_000;

  const units = urgent
    ? [
        { value: hours, label: "hod" },
        { value: minutes, label: "min" },
        { value: seconds, label: "s" },
      ]
    : [
        { value: days, label: days === 1 ? "den" : "dní" },
        { value: hours, label: "hod" },
        { value: minutes, label: "min" },
      ];

  return (
    <div className="mt-2.5 flex gap-1.5">
      {units.map((u, i) => (
        <div
          key={i}
          className="min-w-[38px] rounded-lg border border-black/10 bg-black/[0.03] px-1.5 py-1 text-center dark:border-white/10 dark:bg-white/[0.04]"
        >
          <div
            className={cn(
              "text-base font-bold leading-none tabular-nums",
              urgent ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-accent"
            )}
          >
            {urgent ? String(u.value).padStart(2, "0") : u.value}
          </div>
          <div className="mt-1 text-[9px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {u.label}
          </div>
        </div>
      ))}
    </div>
  );
}

type Step = {
  state: StepState;
  when: string;
  title: string;
  desc?: string;
  live?: boolean;
  countdownTo?: string;
  points?: number;
};

export function EventStatusTimeline({
  locked,
  completed,
  lockAtIso,
  eventDateIso,
  tippedCount,
  totalCount,
  gradedCount,
  points,
}: {
  locked: boolean;
  completed: boolean;
  lockAtIso: string | null;
  eventDateIso: string;
  tippedCount: number;
  totalCount: number;
  gradedCount: number;
  points: number;
}) {
  const tipState: StepState = locked || completed ? "done" : "current";
  const liveState: StepState = completed ? "done" : locked ? "current" : "future";
  const doneState: StepState = completed ? "current" : "future";

  const lockLabel = lockAtIso ? shortDateTime(lockAtIso) : null;

  const steps: Step[] = [
    {
      state: tipState,
      when:
        tipState === "current"
          ? lockLabel
            ? `Teď · uzavře se ${lockLabel}`
            : "Teď"
          : lockLabel
            ? `Uzavřeno ${lockLabel}`
            : "Uzavřeno",
      title: tipState === "current" ? "Tipování otevřené" : "Tipování uzamčeno",
      desc:
        tipState === "current"
          ? `Máš natipováno ${tippedCount} z ${totalCount} zápasů.`
          : `Tvých ${totalCount} tipů je zamčených, jen pro čtení.`,
      countdownTo: tipState === "current" && lockAtIso ? lockAtIso : undefined,
    },
    {
      state: liveState,
      when:
        liveState === "current"
          ? "Právě teď"
          : `${shortDateTime(eventDateIso)}${liveState === "future" ? "" : ""}`,
      title: liveState === "done" ? "Galavečer odjel" : "Galavečer živě",
      desc:
        liveState === "current"
          ? `Odbodováno ${gradedCount} z ${totalCount} zápasů${points > 0 ? ` · zatím ${points} b.` : ""}.`
          : liveState === "future"
            ? `Od ${shortTime(eventDateIso)} · tipy se zamknou, výsledky naskakují průběžně.`
            : undefined,
      live: liveState === "current",
    },
    {
      state: doneState,
      when: doneState === "current" ? "Vyhodnoceno" : "Po skončení",
      title: doneState === "current" ? "Konečné pořadí" : "Vyhodnoceno",
      desc:
        doneState === "current"
          ? `Odbodováno ${gradedCount} z ${totalCount} zápasů.`
          : "Body se sečtou a rozdělí se startovné.",
      points: doneState === "current" ? points : undefined,
    },
  ];

  return (
    <div className="mt-3 rounded-xl border border-white/45 bg-white/35 p-4 shadow-lg shadow-black/20 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        <Clock className="size-3.5 text-yellow-600 dark:text-accent" />
        Stav galavečera
      </p>

      <div>
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          return (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center self-stretch">
                <Dot state={step.state} />
                {!last && <span className="w-0.5 flex-1 bg-black/10 dark:bg-white/10" />}
              </div>
              <div className={cn("min-w-0 flex-1", last ? "pb-1" : "pb-4")}>
                <div
                  className={cn(
                    "flex items-center gap-2 text-[11px] font-bold tracking-wide",
                    step.state === "current"
                      ? "text-yellow-600 dark:text-accent"
                      : "text-neutral-400 dark:text-neutral-500"
                  )}
                >
                  <span>{step.when}</span>
                  {step.live && (
                    <span className="inline-flex items-center gap-1 text-red-500">
                      <span className="relative flex size-1.5">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-75" />
                        <span className="relative inline-flex size-1.5 rounded-full bg-red-500" />
                      </span>
                      Živě
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    "text-sm font-semibold",
                    step.state === "future"
                      ? "text-neutral-500 dark:text-neutral-400"
                      : "text-black dark:text-white"
                  )}
                >
                  {step.title}
                </div>
                {step.desc && (
                  <div className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-300">{step.desc}</div>
                )}
                {step.countdownTo && <Countdown targetIso={step.countdownTo} />}
                {step.points != null && (
                  <div className="mt-2 inline-flex items-baseline gap-2 rounded-full border border-accent/60 bg-accent/15 px-3 py-1">
                    <span className="text-[11px] text-neutral-600 dark:text-neutral-300">Tvé body</span>
                    <span className="text-lg font-bold tabular-nums">{step.points}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
