import Image from "next/image";
import { FighterPortrait } from "@/components/fighter-portrait";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { weightClassLabel } from "@/lib/weight-classes";
import { METHOD_LABELS } from "@/lib/method-labels";
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

function pointsLabel(points: number | null | undefined) {
  if (points == null) return "—";
  return points > 0 ? `+${points} b.` : `${points} b.`;
}

export function CompareFightCard({
  fight,
  predictionA,
  predictionB,
  nicknameA,
  nicknameB,
}: {
  fight: Fight;
  predictionA: Prediction | null;
  predictionB: Prediction | null;
  nicknameA: string;
  nicknameB: string;
}) {
  const voided = fight.status === "cancelled" || fight.status === "no_contest";
  const showResult = fight.status === "completed";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border shadow-lg shadow-black/20 dark:shadow-black/60",
        voided ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40" : "border-white/45 bg-white/35 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {fight.weight_class && <Badge variant="secondary">{weightClassLabel(fight.weight_class)}</Badge>}
          {fight.is_title_fight && <Badge variant="accent">Titulový zápas</Badge>}
          {fight.is_main_event && <Badge variant="default">Main event</Badge>}
          {voided && <Badge variant="outline">Zrušeno / NC</Badge>}
        </div>
        <div className="flex items-center gap-3 text-sm font-bold">
          <span className="text-[#FFD400]">
            {nicknameA}: {pointsLabel(predictionA?.points)}
          </span>
          <span className="text-blue-500">
            {nicknameB}: {pointsLabel(predictionB?.points)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-neutral-200 border-t border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {[fight.fighter_a, fight.fighter_b].map((fighter) => {
          const tipA = predictionA?.predicted_winner_id === fighter.id;
          const tipB = predictionB?.predicted_winner_id === fighter.id;
          const isActualWinner = showResult && fight.winner_fighter_id === fighter.id;
          const isActualLoser = showResult && fight.winner_fighter_id !== fighter.id;
          const grayedOut = isActualLoser || fight.status === "no_contest";
          return (
            <div
              key={fighter.id}
              className={cn(
                "flex flex-col items-center gap-1.5 px-2 pb-3 text-center",
                (tipA || tipB) && "bg-neutral-50 dark:bg-neutral-900/50"
              )}
            >
              <FighterPortrait
                name={fighter.name}
                photoUrl={fighter.photo_url ?? fighter.fight_card_photo_url}
                grayedOut={grayedOut}
                className={cn(
                  tipA && tipB && "ring-2 ring-inset ring-[#FFD400]",
                  tipA && !tipB && "ring-2 ring-inset ring-[#FFD400]",
                  !tipA && tipB && "ring-2 ring-inset ring-blue-500"
                )}
              />
              <div className="mt-1.5">
                <FighterLabel fighter={fighter} />
              </div>
              {fighter.oktagon_rank && (
                <span className="text-xs text-neutral-500 dark:text-neutral-300">{fighter.oktagon_rank}</span>
              )}
              <div className="flex flex-wrap items-center justify-center gap-1">
                {tipA && (
                  <span className="rounded-full border border-[#FFD400] bg-[#FFD400]/10 px-2 py-0.5 text-[10px] font-bold text-[#FFD400]">
                    {nicknameA}
                  </span>
                )}
                {tipB && (
                  <span className="rounded-full border border-blue-500 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-500">
                    {nicknameB}
                  </span>
                )}
                {isActualWinner && <Badge variant="accent">Výherce</Badge>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1 p-4 pt-3 text-sm">
        <p className="text-neutral-700 dark:text-neutral-300">
          {nicknameA} tip: {predictionA ? `${METHOD_LABELS[predictionA.predicted_method]}${predictionA.predicted_round ? ` · ${predictionA.predicted_round}. kolo` : ""}` : "bez tipu"}
        </p>
        <p className="text-neutral-700 dark:text-neutral-300">
          {nicknameB} tip: {predictionB ? `${METHOD_LABELS[predictionB.predicted_method]}${predictionB.predicted_round ? ` · ${predictionB.predicted_round}. kolo` : ""}` : "bez tipu"}
        </p>
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
