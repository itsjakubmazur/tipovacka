import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { weightClassLabel } from "@/lib/weight-classes";
import { METHOD_LABELS } from "@/lib/method-labels";
import { FightMatchup } from "@/components/predictions/fight-matchup";
import { pointsLabel } from "@/lib/score-breakdown";
import type { Fight, Prediction } from "@/lib/types";

/** Two tippers on the same fight. Same matchup as everywhere else - the
 * difference is that both picks are marked, each in its own colour, so you
 * can see at a glance where they split. */
export function CompareFightCard({
  fight,
  predictionA,
  predictionB,
  nicknameA,
  nicknameB,
  boldA,
  boldB,
}: {
  fight: Fight;
  predictionA: Prediction | null;
  predictionB: Prediction | null;
  nicknameA: string;
  nicknameB: string;
  /** whether this fight is that tipper's jistotka */
  boldA?: boolean;
  boldB?: boolean;
}) {
  const voided = fight.status === "cancelled" || fight.status === "no_contest";
  const showResult = fight.status === "completed";

  function tipLine(nickname: string, prediction: Prediction | null) {
    if (!prediction) return `${nickname}: bez tipu`;
    const round = prediction.predicted_round ? `${prediction.predicted_round}. kolo` : "na body";
    return `${nickname}: ${METHOD_LABELS[prediction.predicted_method]} · ${round}`;
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border shadow-lg shadow-black/20 dark:shadow-black/60",
        voided
          ? "glass-danger"
          : "glass-surface border"
      )}
    >
      <div className="flex min-h-[2.75rem] items-center justify-between gap-2 border-b border-black/5 px-3 py-2 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-x-2">
          {fight.is_main_event && fight.is_title_fight ? (
            <Badge variant="accent" className="shrink-0">Main event · titul</Badge>
          ) : fight.is_title_fight ? (
            <Badge variant="accent" className="shrink-0">Titulový zápas</Badge>
          ) : fight.is_main_event ? (
            <Badge variant="default" className="shrink-0">Main event</Badge>
          ) : null}
          {voided && <Badge variant="outline" className="shrink-0">Zrušeno / NC</Badge>}
          {fight.weight_class && (
            <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              {weightClassLabel(fight.weight_class)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs font-bold tabular-nums">
          <span className="text-yellow-600 dark:text-accent">
            {nicknameA} {pointsLabel(predictionA?.points, boldA)}
          </span>
          <span className="text-blue-500">
            {nicknameB} {pointsLabel(predictionB?.points, boldB)}
          </span>
        </div>
      </div>

      {showResult && (
        <div className="grid grid-cols-3 border-b border-black/5 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03]">
          {[
            { k: "Čas", v: fight.result_time ?? "—" },
            { k: "Kolo", v: fight.result_round ? String(fight.result_round) : "—" },
            { k: "Ukončení", v: fight.method ? METHOD_LABELS[fight.method] : "—" },
          ].map((cell, i) => (
            <div
              key={cell.k}
              className={cn("px-2 py-2 text-center", i > 0 && "border-l border-black/5 dark:border-white/10")}
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
        eager
        highlight={[
          ...(predictionA
            ? [{ fighterId: predictionA.predicted_winner_id, tone: "accent" as const }]
            : []),
          ...(predictionB
            ? [{ fighterId: predictionB.predicted_winner_id, tone: "blue" as const }]
            : []),
        ]}
        tags={[
          ...(showResult && fight.winner_fighter_id
            ? [{ fighterId: fight.winner_fighter_id, label: "Vítěz", tone: "green" as const }]
            : []),
          ...(predictionA
            ? [
                {
                  fighterId: predictionA.predicted_winner_id,
                  label: boldA ? `★ ${nicknameA}` : nicknameA,
                  tone: "accent" as const,
                },
              ]
            : []),
          ...(predictionB
            ? [
                {
                  fighterId: predictionB.predicted_winner_id,
                  label: boldB ? `★ ${nicknameB}` : nicknameB,
                  tone: "blue" as const,
                },
              ]
            : []),
        ]}
      />

      <div className="flex flex-col gap-0.5 border-t border-black/5 px-4 py-2 text-xs text-neutral-600 dark:border-white/10 dark:text-neutral-300">
        <p>{tipLine(nicknameA, predictionA)}</p>
        <p>{tipLine(nicknameB, predictionB)}</p>
      </div>
    </div>
  );
}
