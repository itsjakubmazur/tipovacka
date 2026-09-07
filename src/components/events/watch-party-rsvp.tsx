"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Beer, Minus, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SegmentedControl, type Segment } from "@/components/ui/segmented-control";
import {
  MAX_PLUS_ONES,
  answerFor,
  choiceOf,
  detailLine,
  headline,
  namesOf,
  summarize,
  type WatchPartyChoice,
  type WatchPartyMine,
  type WatchPartyRow,
} from "@/lib/watch-party";

// Plné popisky se na úzkém mobilu do čtyř segmentů nevejdou, celé znění nese
// title (a s ním i čtečka obrazovky).
const SEGMENTS: Segment[] = [
  { key: "alone", label: "Sám", title: "Přijdu sám" },
  { key: "plus", label: "S někým", title: "Přijdu s někým" },
  { key: "maybe", label: "Možná", title: "Ještě nevím" },
  { key: "no", label: "Ne", title: "Nedorazím" },
];

// Klikání na +/- je burst: tři klepnutí by jinak znamenala tři zápisy a tři
// realtime echa zpátky do téhle karty. Píše se až poslední hodnota.
const WRITE_DEBOUNCE_MS = 300;

function StepperButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="glass-field flex size-7 items-center justify-center rounded-full border outline-none transition-transform duration-200 ease-out active:scale-90 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 motion-reduce:transition-none"
    >
      {children}
    </button>
  );
}

/** Odpověď na sledovačku: čtyři tlačítka a u „S někým“ počet hostů.
 *
 * Vlastní řádek si drží klient (odpověď je vidět hned, zápis jde se
 * zpožděním), cizí řádky chodí z props - detail galavečera je překreslí, až
 * RealtimeRefresh zachytí cizí zápis do `watch_party_rsvps`. */
export function WatchPartyRsvp({
  eventId,
  userId,
  nickname,
  rows,
  place,
  when,
  note,
}: {
  eventId: string;
  userId: string;
  nickname: string;
  rows: WatchPartyRow[];
  place: string;
  when: string | null;
  note: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);

  const fromServer = rows.find((r) => r.userId === userId) ?? null;
  const serverAnswer = fromServer?.answer ?? null;
  const serverPlusOnes = fromServer?.plusOnes ?? 0;

  const [mine, setMine] = useState<WatchPartyMine | null>(
    serverAnswer ? { answer: serverAnswer, plusOnes: serverPlusOnes } : null
  );

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queued = useRef<WatchPartyMine | null>(null);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const value = queued.current;
    queued.current = null;
    if (!value) return;
    void supabase.from("watch_party_rsvps").upsert(
      { event_id: eventId, user_id: userId, answer: value.answer, plus_ones: value.plusOnes },
      { onConflict: "event_id,user_id" }
    );
  }, [supabase, eventId, userId]);

  const commit = useCallback(
    (next: WatchPartyMine) => {
      setMine(next);
      queued.current = next;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, WRITE_DEBOUNCE_MS);
    },
    [flush]
  );

  // Odchod ze stránky do 300 ms po klepnutí by jinak odpověď zahodil.
  useEffect(() => () => flush(), [flush]);

  // Novější pravda ze serveru (třeba když si to člověk přepsal na druhém
  // zařízení) - ale ne přes rozepsaný zápis, ten by přepsala zpátky.
  useEffect(() => {
    if (queued.current) return;
    setMine(serverAnswer ? { answer: serverAnswer, plusOnes: serverPlusOnes } : null);
  }, [serverAnswer, serverPlusOnes]);

  const choice = choiceOf(mine);

  // Vlastní řádek přebíjí ten ze serveru, ať je klepnutí vidět v součtu hned.
  const merged: WatchPartyRow[] = mine
    ? fromServer
      ? rows.map((r) => (r.userId === userId ? { ...r, ...mine } : r))
      : [...rows, { userId, nickname, ...mine }]
    : rows.filter((r) => r.userId !== userId);

  const summary = summarize(merged);
  const detail = detailLine(summary);

  function handleChoice(key: string) {
    commit(answerFor(key as WatchPartyChoice, mine?.plusOnes ?? 0));
  }

  function setGuests(count: number) {
    commit({ answer: "yes", plusOnes: Math.min(Math.max(count, 1), MAX_PLUS_ONES) });
  }

  const guests = mine?.plusOnes ?? 0;

  return (
    <div className="flex flex-col gap-2.5 rounded-xl glass-surface border p-3.5">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Beer className="size-4 text-yellow-600 dark:text-accent" />
          Sledovačka
        </p>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {place}
          {when && ` · ${when}`}
        </p>
      </div>

      {note && <p className="text-sm">{note}</p>}

      <SegmentedControl
        segments={SEGMENTS}
        value={choice}
        onChange={handleChoice}
        size="sm"
        ariaLabel="Dorazíš na sledovačku?"
      />

      {choice === "plus" && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-neutral-600 dark:text-neutral-400">Kolik jich vezmeš?</span>
          <StepperButton label="Ubrat hosta" disabled={guests <= 1} onClick={() => setGuests(guests - 1)}>
            <Minus className="size-3.5" />
          </StepperButton>
          <strong aria-live="polite" className="w-4 text-center tabular-nums">
            {guests}
          </strong>
          <StepperButton
            label="Přidat hosta"
            disabled={guests >= MAX_PLUS_ONES}
            onClick={() => setGuests(guests + 1)}
          >
            <Plus className="size-3.5" />
          </StepperButton>
        </div>
      )}

      <div>
        <p className="text-sm">
          <strong>{headline(summary, userId, false)}</strong>
          {detail && <span className="text-neutral-600 dark:text-neutral-400"> · {detail}</span>}
        </p>
        <div className="flex flex-col text-xs text-neutral-600 dark:text-neutral-400">
          {summary.yes.length > 0 && <span>Dorazí: {namesOf(summary.yes)}</span>}
          {summary.maybe.length > 0 && <span>Možná: {namesOf(summary.maybe)}</span>}
          {summary.no.length > 0 && <span>Ne: {namesOf(summary.no)}</span>}
        </div>
      </div>
    </div>
  );
}
