"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Hand, Pointer, Star, X, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FighterPortrait } from "@/components/fighter-portrait";
import { Badge } from "@/components/ui/badge";
import { ageFromBirthDate, cn } from "@/lib/utils";
import { GLASS_PILL } from "@/lib/pills";
import { weightClassLabel } from "@/lib/weight-classes";
import { METHOD_LABELS } from "@/lib/method-labels";
import type { Fight, Fighter, Method, Prediction } from "@/lib/types";

const SWIPE_THRESHOLD = 60; // px of horizontal drag that commits a fight change
const TAP_SLOP = 8; // movement under this stays a tap, not a swipe
const AUTO_ADVANCE_MS = 500;
const HINT_MS = 2200; // how long the how-to hint lingers before auto-fading

type LocalTip = { winnerId: string | null; method: Method | null; round: number | null };

function tipComplete(t: LocalTip): boolean {
  return Boolean(t.winnerId && t.method && (t.method === "DECISION" || t.round !== null));
}

/** In-page fast-tipping: a full-screen swipe carousel launched from the
 * event header (no route change - opens/closes instantly and never
 * leaves the page, so saved tips are reflected on close without a
 * reload). Drag horizontally between fights, tap a fighter to pick,
 * pick method/round, auto-advances when a tip is complete. */
export function FastTipOverlay({
  eventId,
  userId,
  fights,
  initialPredictions,
  initialBoldFightId,
  tippedCountable,
  totalCountable,
}: {
  eventId: string;
  userId: string;
  fights: Fight[];
  initialPredictions: Record<string, Prediction>;
  initialBoldFightId: string | null;
  tippedCountable: number;
  totalCountable: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[#FFD400] bg-[#FFD400] px-3 py-1 text-xs font-semibold text-black shadow-lg shadow-black/15 transition-transform hover:scale-105"
      >
        <Zap className="size-3.5" />
        Rychlé tipování
      </button>
      {open && (
        <FastTipCarousel
          eventId={eventId}
          userId={userId}
          fights={fights}
          initialPredictions={initialPredictions}
          initialBoldFightId={initialBoldFightId}
          onClose={() => setOpen(false)}
        />
      )}
      {/* keeps the server-rendered counter honest before opening */}
      <span className="sr-only">
        {tippedCountable}/{totalCountable}
      </span>
    </>
  );
}

function FastTipCarousel({
  eventId,
  userId,
  fights,
  initialPredictions,
  initialBoldFightId,
  onClose,
}: {
  eventId: string;
  userId: string;
  fights: Fight[];
  initialPredictions: Record<string, Prediction>;
  initialBoldFightId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [boldFightId, setBoldFightId] = useState<string | null>(initialBoldFightId);

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
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  // hint shows every open, fades on first touch or after HINT_MS
  const [hint, setHint] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pending = useRef<Set<Promise<unknown>>>(new Set());
  const drag = useRef<{ startX: number; moved: boolean } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setHint(false), HINT_MS);
    return () => clearTimeout(t);
  }, []);

  const tippedCount = useMemo(
    () => fights.filter((f) => tipComplete(tips[f.id])).length,
    [fights, tips]
  );
  const done = tippedCount === fights.length;

  function persist(fightId: string, next: LocalTip) {
    if (!tipComplete(next)) return;
    setError(null);
    const p = (async () => {
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
      if (error) setError("Uložení se nepodařilo.");
      window.dispatchEvent(
        new CustomEvent("tip-state-changed", { detail: { fightId, tipped: !error } })
      );
    })();
    pending.current.add(p);
    p.finally(() => pending.current.delete(p));
  }

  function update(fightId: string, partial: Partial<LocalTip>) {
    setTips((prev) => {
      const next = { ...prev[fightId], ...partial };
      if (partial.method === "DECISION") next.round = null;
      persist(fightId, next);
      if (tipComplete(next)) {
        const i = fights.findIndex((f) => f.id === fightId);
        if (i >= 0 && i < fights.length - 1) {
          setTimeout(() => setIndex((cur) => (cur === i ? cur + 1 : cur)), AUTO_ADVANCE_MS);
        }
      }
      return { ...prev, [fightId]: next };
    });
  }

  function toggleBold(fightId: string) {
    const willBe = boldFightId !== fightId; // tapping the current bold clears it
    setBoldFightId(willBe ? fightId : null);
    setError(null);
    // keep the underlying fight cards in sync live (they listen for this)
    window.dispatchEvent(
      new CustomEvent("bold-state-changed", { detail: { fightId: willBe ? fightId : null } })
    );
    const p = (async () => {
      const { error } = willBe
        ? await supabase
            .from("bold_picks")
            .upsert({ event_id: eventId, user_id: userId, fight_id: fightId }, { onConflict: "event_id,user_id" })
        : await supabase.from("bold_picks").delete().eq("event_id", eventId).eq("user_id", userId);
      if (error) setError("Uložení jistotky se nepodařilo.");
    })();
    pending.current.add(p);
    p.finally(() => pending.current.delete(p));
  }

  async function close() {
    // wait for in-flight saves so the page below reflects them on refresh
    await Promise.allSettled([...pending.current]);
    onClose();
    router.refresh();
  }

  // pointer drag between fights
  function onPointerDown(e: React.PointerEvent) {
    if (hint) setHint(false);
    drag.current = { startX: e.clientX, moved: false };
    setDragging(true);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const delta = e.clientX - drag.current.startX;
    if (Math.abs(delta) > TAP_SLOP) drag.current.moved = true;
    // rubber-band at the ends
    const atStart = index === 0 && delta > 0;
    const atEnd = index === fights.length - 1 && delta < 0;
    setDragX(atStart || atEnd ? delta / 3 : delta);
  }
  function onPointerUp() {
    if (!drag.current) return;
    const delta = dragX;
    setDragging(false);
    setDragX(0);
    if (delta <= -SWIPE_THRESHOLD && index < fights.length - 1) setIndex((i) => i + 1);
    else if (delta >= SWIPE_THRESHOLD && index > 0) setIndex((i) => i - 1);
    // reset moved flag on next tick so the click that follows is judged correctly
    setTimeout(() => {
      if (drag.current) drag.current = { startX: 0, moved: false };
    }, 0);
    drag.current = null;
  }

  function pick(fightId: string, fn: () => void) {
    // ignore the click that ends a swipe gesture
    if (drag.current?.moved) return;
    if (hint) setHint(false);
    fn();
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background">
      {/* top bar */}
      <div className="flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
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

      {/* carousel track */}
      <div
        className="relative flex-1 touch-pan-y overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className={cn("flex h-full", !dragging && "transition-transform duration-300 ease-out")}
          style={{
            width: `${fights.length * 100}%`,
            transform: `translateX(calc(${(-index * 100) / fights.length}% + ${dragX}px))`,
          }}
        >
          {fights.map((fight) => (
            <FightSlide
              key={fight.id}
              fight={fight}
              tip={tips[fight.id]}
              isBold={boldFightId === fight.id}
              width={`${100 / fights.length}%`}
              onPickWinner={(id) => pick(fight.id, () => update(fight.id, { winnerId: id }))}
              onPickMethod={(m) => pick(fight.id, () => update(fight.id, { method: m }))}
              onPickRound={(r) => pick(fight.id, () => update(fight.id, { round: r }))}
              onToggleBold={() => pick(fight.id, () => toggleBold(fight.id))}
            />
          ))}
        </div>
      </div>

      {/* dots */}
      <div className="flex flex-wrap justify-center gap-1.5 px-4 py-2">
        {fights.map((f, i) => (
          <button
            key={f.id}
            type="button"
            aria-label={`Zápas ${i + 1}`}
            onClick={() => setIndex(i)}
            className={cn(
              "size-2 rounded-full transition-colors",
              i === index
                ? "bg-[#FFD400]"
                : tipComplete(tips[f.id])
                  ? "bg-neutral-400 dark:bg-neutral-500"
                  : "bg-neutral-200 dark:bg-neutral-700"
            )}
          />
        ))}
      </div>

      {error && <p className="px-4 pb-1 text-center text-sm text-red-600">{error}</p>}

      {done && (
        <div className="px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={close}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-[#FFD400] bg-[#FFD400] py-3 text-sm font-semibold text-black"
          >
            <Check className="size-4" strokeWidth={3} />
            Hotovo, máš tipnuto vše
          </button>
        </div>
      )}

      {/* how-to hint: shows every open, non-blocking (taps pass through),
          fades on first touch or after HINT_MS */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-500",
          hint ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="flex items-center gap-8 rounded-2xl bg-black/70 px-7 py-5 text-white backdrop-blur-sm">
          <span className="flex flex-col items-center gap-1.5 text-xs font-medium">
            <Pointer className="size-7 text-[#FFD400]" />
            Klepni na vítěze
          </span>
          <span className="flex flex-col items-center gap-1.5 text-xs font-medium">
            <Hand className="size-7 text-[#FFD400]" />
            Potáhni na další
          </span>
        </div>
      </div>
    </div>
  );
}

function TapeRow({ label, a, b }: { label: string; a: string | null; b: string | null }) {
  if (!a && !b) return null;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
      <span className="text-right font-medium tabular-nums">{a ?? "–"}</span>
      <span className="text-[11px] uppercase tracking-wide text-neutral-400 dark:text-neutral-500">{label}</span>
      <span className="font-medium tabular-nums">{b ?? "–"}</span>
    </div>
  );
}

function FightSlide({
  fight,
  tip,
  isBold,
  width,
  onPickWinner,
  onPickMethod,
  onPickRound,
  onToggleBold,
}: {
  fight: Fight;
  tip: LocalTip;
  isBold: boolean;
  width: string;
  onPickWinner: (id: string) => void;
  onPickMethod: (m: Method) => void;
  onPickRound: (r: number) => void;
  onToggleBold: () => void;
}) {
  return (
    <div style={{ width }} className="h-full shrink-0 overflow-y-auto px-4 pb-4">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {fight.weight_class && <Badge variant="secondary">{weightClassLabel(fight.weight_class)}</Badge>}
          {fight.is_title_fight && <Badge variant="accent">Titulový zápas</Badge>}
          {fight.is_main_event && <Badge variant="default">Main event</Badge>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[fight.fighter_a, fight.fighter_b].map((fighter: Fighter) => (
            <button
              key={fighter.id}
              type="button"
              onClick={() => onPickWinner(fighter.id)}
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

        <div className="flex flex-col gap-1 rounded-xl border border-white/45 bg-white/35 p-3 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35">
          <TapeRow label="Rekord" a={fight.fighter_a.record} b={fight.fighter_b.record} />
          <TapeRow
            label="Kurz"
            a={fight.odds_fighter_a != null ? fight.odds_fighter_a.toFixed(2) : null}
            b={fight.odds_fighter_b != null ? fight.odds_fighter_b.toFixed(2) : null}
          />
          <TapeRow
            label="Výška"
            a={fight.fighter_a.height_cm ? `${fight.fighter_a.height_cm} cm` : null}
            b={fight.fighter_b.height_cm ? `${fight.fighter_b.height_cm} cm` : null}
          />
          <TapeRow
            label="Věk"
            a={fight.fighter_a.birth_date ? `${ageFromBirthDate(fight.fighter_a.birth_date)}` : null}
            b={fight.fighter_b.birth_date ? `${ageFromBirthDate(fight.fighter_b.birth_date)}` : null}
          />
          <TapeRow label="Rank" a={fight.fighter_a.oktagon_rank} b={fight.fighter_b.oktagon_rank} />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap justify-center gap-2">
            {(Object.keys(METHOD_LABELS) as Method[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onPickMethod(m)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium",
                  tip.method === m ? "border border-[#FFD400] bg-[#FFD400] text-black" : GLASS_PILL
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
                  onClick={() => onPickRound(r)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium",
                    tip.round === r ? "border border-[#FFD400] bg-[#FFD400] text-black" : GLASS_PILL
                  )}
                >
                  {r}. kolo
                </button>
              ))}
            </div>
          )}
        </div>

        {tip.winnerId && (
          <button
            type="button"
            onClick={onToggleBold}
            className={cn(
              "flex items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-semibold transition-colors",
              isBold
                ? "border-[#FFD400] bg-[#FFD400]/15 text-yellow-700 dark:text-[#FFD400]"
                : "border-neutral-300 text-neutral-600 hover:border-[#FFD400] dark:border-neutral-600 dark:text-neutral-300"
            )}
          >
            <Star className="size-4" fill={isBold ? "currentColor" : "none"} />
            {isBold ? "Jistotka ×2 — body dvakrát" : "Dát jistotku (body ×2)"}
          </button>
        )}
      </div>
    </div>
  );
}
