import { cn } from "@/lib/utils";
import { describeHistoryResult } from "@/lib/fighter-history";
import type { FighterHistoryEntry } from "@/lib/types";

// A draw is neither good nor bad, but it still has to look like one of the
// row - .glass-pill is built for a wide pill and leaves a 20px circle with
// almost nothing on it, which in light mode reads as a rendering bug.
const NEUTRAL =
  "border-black/10 bg-black/[0.06] text-neutral-600 dark:border-white/15 dark:bg-white/10 dark:text-neutral-300";

const OUTCOME_STYLES: Record<string, string> = {
  win: "glass-green",
  loss: "glass-danger",
  draw: NEUTRAL,
  no_contest: NEUTRAL,
};

const OUTCOME_LETTERS: Record<string, string> = {
  win: "V",
  loss: "P",
  draw: "R",
  no_contest: "N",
};

/** The last few fights as one row of letters, newest first - the shape every
 * MMA site uses, because a run of five beats a paragraph at saying "he is on
 * a streak". Czech letters (výhra/prohra/remíza), not W/L, since nothing else
 * in the app speaks English at the tipper. */
export function FighterForm({
  form,
  className,
}: {
  form: FighterHistoryEntry[];
  className?: string;
}) {
  if (form.length === 0) return null;
  return (
    <span className={cn("flex items-center gap-1", className)}>
      {form.map((entry) => (
        <span
          key={entry.oktagon_fight_id}
          title={`${entry.event_label}: ${entry.opponent_name} — ${describeHistoryResult(entry)}`}
          className={cn(
            "flex size-5 items-center justify-center rounded-full border text-[10px] font-bold",
            OUTCOME_STYLES[entry.outcome] ?? NEUTRAL
          )}
        >
          {OUTCOME_LETTERS[entry.outcome] ?? "?"}
        </span>
      ))}
    </span>
  );
}
