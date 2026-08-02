import { TrendingUp, TrendingDown, Minus, Route } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = {
  fightId: string;
  label: string;
  gains: Record<string, number>;
};

/** Your night in three sentences, reconstructed from the same fight-by-fight
 * data the replay player uses - no extra tables, no extra queries.
 *
 * The final standings tell you where you ended up; this tells you how it went.
 * "Byl jsi druhý, hlavní zápas tě shodil na pátý" is the thing people actually
 * talk about afterwards, and until now the app knew it but never said it. */
export function RankJourney({
  steps,
  userIds,
  currentUserId,
  finalRank,
}: {
  steps: Step[];
  /** everyone who scored at this gala - the field you were ranked against */
  userIds: string[];
  currentUserId: string;
  finalRank: number;
}) {
  if (steps.length < 2 || !userIds.includes(currentUserId)) return null;

  const totals = new Map(userIds.map((id) => [id, 0]));
  // rank after each graded fight, in card order
  const ranks: { rank: number; label: string }[] = [];

  for (const step of steps) {
    for (const [userId, gain] of Object.entries(step.gains)) {
      if (totals.has(userId)) totals.set(userId, (totals.get(userId) ?? 0) + gain);
    }
    const mine = totals.get(currentUserId) ?? 0;
    // shared points share a place, so "ahead of me" is a strict comparison
    const ahead = [...totals.values()].filter((points) => points > mine).length;
    ranks.push({ rank: ahead + 1, label: step.label });
  }

  const best = ranks.reduce((a, b) => (b.rank < a.rank ? b : a));
  const worst = ranks.reduce((a, b) => (b.rank > a.rank ? b : a));

  // the single fight that moved you the most, in either direction
  let biggest: { delta: number; label: string; to: number } | null = null;
  for (let i = 1; i < ranks.length; i++) {
    const delta = ranks[i - 1].rank - ranks[i].rank;
    if (biggest === null || Math.abs(delta) > Math.abs(biggest.delta)) {
      biggest = { delta, label: ranks[i].label, to: ranks[i].rank };
    }
  }

  const flat = best.rank === worst.rank;

  return (
    <div className="glass-surface flex flex-col gap-2 rounded-xl border p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <Route className="size-4 text-yellow-600 dark:text-accent" />
        Tvoje cesta večerem
      </p>

      {flat ? (
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          Celý večer jsi prosedět na <strong>{best.rank}. místě</strong> — ani jednou ses nehnul.
        </p>
      ) : (
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          Nejvýš jsi byl <strong>{best.rank}.</strong>, nejníž <strong>{worst.rank}.</strong>, skončil
          jsi <strong>{finalRank}.</strong>
        </p>
      )}

      {biggest && biggest.delta !== 0 && (
        <p
          className={cn(
            "flex items-start gap-1.5 text-xs",
            biggest.delta > 0
              ? "text-green-700 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          )}
        >
          {biggest.delta > 0 ? (
            <TrendingUp className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <TrendingDown className="mt-0.5 size-3.5 shrink-0" />
          )}
          <span>
            {biggest.delta > 0 ? "Nahoru" : "Dolů"} o {Math.abs(biggest.delta)}{" "}
            {Math.abs(biggest.delta) === 1 ? "místo" : Math.abs(biggest.delta) <= 4 ? "místa" : "míst"}{" "}
            na {biggest.to}. po zápase {biggest.label}.
          </span>
        </p>
      )}

      {biggest && biggest.delta === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <Minus className="size-3.5 shrink-0" />
          Žádný zápas s tebou pořadím nehnul.
        </p>
      )}
    </div>
  );
}
