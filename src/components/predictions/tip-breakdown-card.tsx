import Image from "next/image";
import { FighterPortrait } from "@/components/fighter-portrait";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { weightClassLabel } from "@/lib/weight-classes";
import { METHOD_LABELS } from "@/lib/method-labels";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { Fight, Fighter, Prediction } from "@/lib/types";

function FighterLabel({ fighter }: { fighter: Fighter }) {
  return (
    <span className="flex items-center gap-1.5 text-sm font-semibold">
      {fighter.flag_code && (
        <Image
          src={`https://flagcdn.com/h20/${fighter.flag_code}.png`}
          alt={fighter.nationality ?? ""}
          title={fighter.nationality ?? undefined}
          width={16}
          height={11}
          unoptimized
          className="h-auto w-4"
        />
      )}
      {fighter.name}
    </span>
  );
}

export function TipBreakdownCard({
  fight,
  prediction,
}: {
  fight: Fight;
  prediction: Prediction | null;
}) {
  const voided = fight.status === "cancelled" || fight.status === "no_contest";
  const showResult = fight.status === "completed";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border",
        voided ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40" : "border-neutral-200 dark:border-neutral-800"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {fight.weight_class && <Badge variant="secondary">{weightClassLabel(fight.weight_class)}</Badge>}
          {fight.is_title_fight && <Badge variant="accent">Titulový zápas</Badge>}
          {fight.is_main_event && <Badge variant="default">Main event</Badge>}
          {voided && <Badge variant="outline">Zrušeno / NC</Badge>}
        </div>
        {prediction && (
          <span
            className={cn(
              "text-sm font-bold",
              prediction.points == null
                ? "text-neutral-400"
                : prediction.points > 0
                  ? "text-green-700"
                  : "text-neutral-500 dark:text-neutral-300"
            )}
          >
            {prediction.points == null ? "—" : `+${prediction.points} b.`}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 divide-x divide-neutral-200 border-t border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {[fight.fighter_a, fight.fighter_b].map((fighter) => {
          const isTip = prediction?.predicted_winner_id === fighter.id;
          const isActualWinner = showResult && fight.winner_fighter_id === fighter.id;
          const isActualLoser = showResult && fight.winner_fighter_id !== fighter.id;
          const grayedOut = isActualLoser || fight.status === "no_contest";
          return (
            <div
              key={fighter.id}
              className={cn(
                "flex flex-col items-center gap-1.5 px-2 pb-3 text-center",
                isTip && "bg-[#FFD400]/10"
              )}
            >
              <FighterPortrait
                name={fighter.name}
                photoUrl={fighter.photo_url ?? fighter.fight_card_photo_url}
                grayedOut={grayedOut}
                className={cn(isTip && "ring-2 ring-inset ring-[#FFD400]")}
              />
              <div className="mt-1.5">
                <FighterLabel fighter={fighter} />
              </div>
              {fighter.oktagon_rank && (
                <span className="flex items-center gap-0.5 text-xs text-neutral-500 dark:text-neutral-300">
                  {fighter.oktagon_rank}
                  {fighter.oktagon_rank_change != null && fighter.oktagon_rank_change !== 0 && (
                    <span className={cn("flex items-center", fighter.oktagon_rank_change > 0 ? "text-green-600" : "text-red-600")}>
                      {fighter.oktagon_rank_change > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                    </span>
                  )}
                </span>
              )}
              {(() => {
                const odds = fighter.id === fight.fighter_a.id ? fight.odds_fighter_a : fight.odds_fighter_b;
                return (
                  odds != null && (
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-300">
                      Kurz: {odds.toFixed(2)}
                    </span>
                  )
                );
              })()}
              <div className="flex flex-wrap items-center justify-center gap-1">
                {isTip && <Badge variant="secondary">Tip</Badge>}
                {isActualWinner && <Badge variant="accent">Výherce</Badge>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 p-4 pt-3 text-sm">
        {prediction ? (
          <p className="text-neutral-700 dark:text-neutral-300">
            Tip: {METHOD_LABELS[prediction.predicted_method]}
            {prediction.predicted_round ? ` · ${prediction.predicted_round}. kolo` : ""}
          </p>
        ) : (
          <p className="text-neutral-400">Bez tipu.</p>
        )}
        {showResult && (
          <p className="text-neutral-700 dark:text-neutral-300">
            Výsledek: {fight.method ? METHOD_LABELS[fight.method] : ""}
            {fight.result_round ? ` · ${fight.result_round}. kolo` : ""}
            {fight.result_time ? ` · ${fight.result_time}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
