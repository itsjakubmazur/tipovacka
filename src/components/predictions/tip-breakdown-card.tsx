import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { weightClassLabel } from "@/lib/weight-classes";
import { METHOD_LABELS } from "@/lib/method-labels";
import { FightMatchup } from "@/components/predictions/fight-matchup";
import { pointsLabel } from "@/lib/score-breakdown";
import type { Fight, Prediction } from "@/lib/types";

/** A tipper's read-only view of one fight: the same matchup the tipping card
 * shows, with their pick marked and what it scored underneath. */
export function TipBreakdownCard({
  fight,
  prediction,
  isBold,
}: {
  fight: Fight;
  prediction: Prediction | null;
  /** this fight carried the tipper's jistotka, so its points count twice */
  isBold?: boolean;
}) {
  const voided = fight.status === "cancelled" || fight.status === "no_contest";
  const showResult = fight.status === "completed";
  const graded = prediction?.points != null;
  const hit = graded && prediction!.points! > 0;
  const winnerOk = graded && prediction!.predicted_winner_id === fight.winner_fighter_id;
  const methodOk = winnerOk && prediction!.predicted_method === fight.method;
  const roundOk =
    winnerOk &&
    (fight.method === "DECISION"
      ? prediction!.predicted_round == null
      : prediction!.predicted_round === fight.result_round);

  /** Green when that part of the tip landed, red when it didn't - the same
   * thing the tipping card says by colouring the pills you chose. */
  function part(ok: boolean, text: string) {
    if (!graded) return <span>{text}</span>;
    return (
      <span
        className={cn(
          "font-semibold",
          ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
        )}
      >
        {text}
      </span>
    );
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
        {graded ? (
          <span
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums",
              hit
                ? "glass-success text-green-800 dark:text-green-300"
                : "glass-danger text-red-700 dark:text-red-300"
            )}
          >
            {pointsLabel(prediction?.points, isBold)}
          </span>
        ) : (
          isBold && <Badge variant="accent">★ Jistotka ×2</Badge>
        )}
      </div>

      <FightMatchup
        fight={fight}
        eager
        highlight={
          prediction ? [{ fighterId: prediction.predicted_winner_id, tone: "accent" }] : undefined
        }
        tags={[
          ...(showResult && fight.winner_fighter_id
            ? [{ fighterId: fight.winner_fighter_id, label: "Vítěz", tone: "green" as const }]
            : []),
          ...(prediction
            ? [
                {
                  fighterId: prediction.predicted_winner_id,
                  label: isBold ? "★ Jistotka ×2" : "Tip",
                  tone: "accent" as const,
                },
              ]
            : []),
        ]}
      />

      <div className="border-t border-black/5 px-4 py-2 text-xs text-neutral-600 dark:border-white/10 dark:text-neutral-300">
        {prediction ? (
          <>
            Tvůj tip: {part(methodOk, METHOD_LABELS[prediction.predicted_method])}
            {" · "}
            {part(
              roundOk,
              prediction.predicted_round ? `${prediction.predicted_round}. kolo` : "na body"
            )}
          </>
        ) : (
          "Bez tipu"
        )}
      </div>
    </div>
  );
}
