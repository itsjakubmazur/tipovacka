"use client";

import { Fragment } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ageFromBirthDate } from "@/lib/utils";
import type { Fight, Fighter } from "@/lib/types";

export type MatchupTone = "accent" | "green" | "blue";

const TAG_TONES: Record<MatchupTone, string> = {
  accent: "glass-accent",
  green: "bg-green-600 text-white",
  blue: "bg-blue-500 text-white",
};

const WASH_TONES: Record<MatchupTone, string> = {
  accent: "from-accent/25",
  green: "from-green-500/20",
  blue: "from-blue-500/25",
};

/** The matchup itself: weight class, the two names leaning toward their own
 * fighter, the cut-outs facing each other and the tale of the tape between
 * them.
 *
 * One component rather than three near-copies. The same matchup shows up on
 * the tipping card, in a tipper's per-event breakdown and in the two-tipper
 * comparison, and before this they were three separate hand-built layouts
 * that drifted apart every time one of them was touched. */
export function FightMatchup({
  fight,
  tags,
  highlight,
  onPick,
  disabled,
  eager,
}: {
  fight: Fight;
  /** chips pinned to a fighter's photo - stacked when several land on one */
  tags?: { fighterId: string; label: string; tone: MatchupTone }[];
  /** washes the fighter's half of the card */
  highlight?: { fighterId: string; tone: MatchupTone }[];
  /** makes each half a pick target */
  onPick?: (fighterId: string) => void;
  disabled?: boolean;
  /** Load the cut-outs immediately instead of lazily.
   *
   * Needed inside the tipper-detail modal: it is its own scroll container, and
   * WebKit's native lazy loading is unreliable in a nested scroller - photos
   * below the fold there simply never started loading, so a graded card showed
   * one fighter and a blank half. On the event page, where ten cards are on
   * one page and the window does the scrolling, lazy loading works and stays. */
  eager?: boolean;
}) {
  const fighterA = fight.fighter_a;
  const fighterB = fight.fighter_b;
  const showResult = fight.status === "completed";
  const hasPhotos = Boolean(
    (!fighterA.is_tba && (fighterA.photo_url ?? fighterA.fight_card_photo_url)) ||
      (!fighterB.is_tba && (fighterB.photo_url ?? fighterB.fight_card_photo_url))
  );

  /** The rows of the tape below the odds. Weight against weight, height
   * against height - which is the whole point of a tale of the tape, and what
   * a single run-on line under each photo could never do. */
  const measures: { a: string | null; b: string | null }[] = [
    {
      a: fighterA.weight_kg ? `${fighterA.weight_kg} kg` : null,
      b: fighterB.weight_kg ? `${fighterB.weight_kg} kg` : null,
    },
    {
      a: fighterA.height_cm ? `${fighterA.height_cm} cm` : null,
      b: fighterB.height_cm ? `${fighterB.height_cm} cm` : null,
    },
    {
      a: fighterA.birth_date ? `${ageFromBirthDate(fighterA.birth_date)} let` : null,
      b: fighterB.birth_date ? `${ageFromBirthDate(fighterB.birth_date)} let` : null,
    },
  ].filter((row) => row.a || row.b);

  function rank(fighter: Fighter) {
    if (!fighter.oktagon_rank) return null;
    return (
      <span className="flex items-center justify-center gap-0.5">
        {fighter.oktagon_rank}
        {fighter.oktagon_rank_change != null && fighter.oktagon_rank_change !== 0 && (
          <span
            className={cn(
              "flex items-center",
              fighter.oktagon_rank_change > 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            )}
          >
            {fighter.oktagon_rank_change > 0 ? (
              <ArrowUp className="size-3" />
            ) : (
              <ArrowDown className="size-3" />
            )}
          </span>
        )}
      </span>
    );
  }

  /** Name, flag and nickname, leaning toward the fighter it belongs to.
   * Centring both made you check which photo each one meant. */
  function nameLine(fighter: Fighter, side: "a" | "b") {
    const isLoser = showResult && fight.winner_fighter_id !== fighter.id;
    const picked = highlight?.some((h) => h.fighterId === fighter.id);
    return (
      <div className={cn("flex flex-col px-1", side === "a" ? "items-start" : "items-end")}>
        <p
          className={cn(
            "flex items-center gap-2 text-xl font-extrabold uppercase leading-tight tracking-tight sm:text-2xl",
            isLoser ? "text-neutral-400 dark:text-neutral-500" : "text-black dark:text-white",
            picked && !showResult && "underline decoration-accent decoration-4 underline-offset-4"
          )}
        >
          {side === "b" && fighter.name}
          {fighter.flag_code && (
            <Image
              src={`https://flagcdn.com/h20/${fighter.flag_code}.png`}
              alt={fighter.nationality ?? ""}
              title={fighter.nationality ?? undefined}
              width={20}
              height={14}
              unoptimized
              className="h-auto w-5 shrink-0"
            />
          )}
          {side === "a" && fighter.name}
        </p>
        {/* No reserved empty line: with the names stacked instead of side by
            side, a missing nickname costs nothing. */}
        {fighter.nickname && (
          <p className="text-xs italic text-neutral-500 dark:text-neutral-400">
            {`„${fighter.nickname}“`}
          </p>
        )}
      </div>
    );
  }

  /** The photo has to be wider than its own aspect ratio needs, otherwise
   * object-contain sizes it by width and leaves a band of empty card above
   * it. At 34% wide against an 11rem band the box is wider than any of
   * OKTAGON's portrait cut-outs, so height is what constrains them and they
   * fill the band. The inner edges overlap the tape by a few percent, which
   * the mask makes invisible. */
  function cutout(fighter: Fighter, side: "a" | "b") {
    const isLoser = showResult && fight.winner_fighter_id !== fighter.id;
    const grayedOut = isLoser || fight.status === "no_contest";
    // imageProfile (photo_url) is the half-body cut-out on a transparent
    // background - the one this layout wants. imageFightCard, despite the
    // name, is the tight head crop OKTAGON uses in its own fight *list*.
    const src = fighter.photo_url ?? fighter.fight_card_photo_url;
    if (!src || fighter.is_tba) return null;
    return (
      // translate3d is load-bearing, not a leftover. iOS Safari sometimes
      // never paints a photo inside the leaderboard modal - the image is
      // there, and rotating the phone shakes it loose, because that forces
      // the relayout Safari was waiting for. FighterPortrait hit this and
      // fixed it the same way; the fix got lost when this layout was rewritten
      // around FightMatchup. Promoting the box to its own GPU layer up front
      // makes Safari composite it immediately.
      //
      // The grey-out also sits here rather than on the image: WebKit is
      // unreliable about a layer carrying mask-image and a filter at once, and
      // the loser's photo is the only one with a filter - which is why the
      // grey halves were the ones that stayed blank.
      <div
        className={cn(
          "absolute bottom-0 h-full w-[34%] [transform:translate3d(0,0,0)] transition-[filter,opacity] duration-500 motion-reduce:transition-none",
          side === "a" ? "left-0" : "right-0",
          grayedOut && "opacity-60 grayscale"
        )}
      >
        <Image
          src={src}
          alt={fighter.name}
          fill
          sizes="200px"
          loading={eager ? "eager" : undefined}
          className={cn(
            "object-contain object-bottom",
            // softens the edge of any photo that turns out to have a
            // background baked in rather than a clean cut-out
            side === "a"
              ? "[mask-image:linear-gradient(to_right,transparent,black_10%)]"
              : "[mask-image:linear-gradient(to_left,transparent,black_10%)]"
          )}
        />
      </div>
    );
  }

  function tapeRow(left: React.ReactNode, right: React.ReactNode) {
    return (
      <>
        <span className="flex items-center justify-center pr-1 text-center leading-tight">{left}</span>
        <span className="flex items-center justify-center pl-1 text-center leading-tight">{right}</span>
      </>
    );
  }

  return (
    <div className="relative">
      {/* Each half is the pick target - a fighter-sized button beats aiming at
          a photo. The display above it is pointer-events-none so taps land
          here rather than on a paragraph. */}
      {onPick && !disabled && (
        <>
          {([fighterA, fighterB] as const).map((fighter, i) => (
            <button
              key={fighter.id}
              type="button"
              onClick={() => onPick(fighter.id)}
              aria-label={`Tipnout ${fighter.name}`}
              className={cn("absolute inset-y-0 z-0 w-1/2", i === 0 ? "left-0" : "right-0")}
            />
          ))}
        </>
      )}
      {highlight?.map((h) => (
        <div
          key={`${h.fighterId}-${h.tone}`}
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 z-0 w-1/2 bg-gradient-to-t to-transparent",
            WASH_TONES[h.tone],
            h.fighterId === fighterA.id ? "left-0" : "right-0"
          )}
        />
      ))}

      <div className="pointer-events-none relative z-10 px-3 pb-2 pt-2.5">
        {/* The weight class used to have a line of its own here. OKTAGON puts
            it in the band at the top of the card, together with what kind of
            fight it is, and they are right: it is a label for the bout, not
            part of the matchup. It now rides in the card header. */}
        {/* No "vs" between the names. One leans left and one leans right, which
            already reads as a matchup - the word was a line of card spent
            confirming something the layout says on its own. */}
        <div className="flex flex-col">
          {nameLine(fighterA, "a")}
          {nameLine(fighterB, "b")}
        </div>

        <div className={cn("relative mt-1.5", hasPhotos && "min-h-[11rem]")}>
          {cutout(fighterA, "a")}
          {cutout(fighterB, "b")}

          {/* The tale of the tape, split the way the fighters are: left half
              belongs to the fighter on the left. A grid rather than two
              stacks, so the rows stay level even when one man's title wraps
              and the other's does not. */}
          <div className="absolute inset-y-0 left-1/2 flex w-[40%] -translate-x-1/2 items-center">
            <div className="relative grid w-full grid-cols-2 gap-x-2 gap-y-0.5 text-center text-[11px] text-neutral-500 dark:text-neutral-400">
              <span
                aria-hidden
                className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-black/10 dark:bg-white/15"
              />
              {tapeRow(rank(fighterA), rank(fighterB))}
              {tapeRow(
                <span className="text-xs font-bold tabular-nums text-black dark:text-white">
                  {fighterA.record ?? "—"}
                </span>,
                <span className="text-xs font-bold tabular-nums text-black dark:text-white">
                  {fighterB.record ?? "—"}
                </span>
              )}
              {(fight.odds_fighter_a != null || fight.odds_fighter_b != null) &&
                tapeRow(
                  <span className="tabular-nums">
                    {fight.odds_fighter_a != null ? `kurz ${fight.odds_fighter_a.toFixed(2)}` : "—"}
                  </span>,
                  <span className="tabular-nums">
                    {fight.odds_fighter_b != null ? `kurz ${fight.odds_fighter_b.toFixed(2)}` : "—"}
                  </span>
                )}
              {measures.map((row, i) => (
                <Fragment key={i}>
                  {tapeRow(
                    <span className="tabular-nums text-neutral-400 dark:text-neutral-500">
                      {row.a ?? "—"}
                    </span>,
                    <span className="tabular-nums text-neutral-400 dark:text-neutral-500">
                      {row.b ?? "—"}
                    </span>
                  )}
                </Fragment>
              ))}
            </div>
          </div>

          {/* Several tags can land on one fighter - you tipped the one who won
              - so they stack instead of sharing a corner. */}
          {([fighterA, fighterB] as const).map((fighter, i) => {
            const own = (tags ?? []).filter((t) => t.fighterId === fighter.id);
            if (own.length === 0) return null;
            return (
              <span
                key={fighter.id}
                className={cn(
                  "absolute bottom-7 z-20 flex flex-col gap-1",
                  i === 0 ? "left-0 items-start" : "right-0 items-end"
                )}
              >
                {own.map((tag) => (
                  <span
                    key={`${tag.label}-${tag.tone}`}
                    className={cn(
                      "max-w-[9rem] truncate rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-lg shadow-black/30",
                      TAG_TONES[tag.tone]
                    )}
                  >
                    {tag.label}
                  </span>
                ))}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
