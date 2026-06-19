import Image from "next/image";
import { FighterAvatar } from "@/components/fighter-avatar";
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
        "rounded-xl border p-4",
        voided ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40" : "border-neutral-200 dark:border-neutral-800"
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
                  : "text-neutral-500 dark:text-neutral-400"
            )}
          >
            {prediction.points == null ? "—" : `+${prediction.points} b.`}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[fight.fighter_a, fight.fighter_b].map((fighter) => {
          const isTip = prediction?.predicted_winner_id === fighter.id;
          const isActualWinner = showResult && fight.winner_fighter_id === fighter.id;
          return (
            <div
              key={fighter.id}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border p-3 text-center",
                isTip ? "border-[#FFD400] bg-[#FFD400]/10" : "border-neutral-200 dark:border-neutral-800"
              )}
            >
              <FighterAvatar name={fighter.name} photoUrl={fighter.photo_url} />
              <FighterLabel fighter={fighter} />
              <div className="flex flex-wrap items-center justify-center gap-1">
                {isTip && <Badge variant="secondary">Tip</Badge>}
                {isActualWinner && <Badge variant="accent">Výherce</Badge>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-col gap-1 text-sm">
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
          </p>
        )}
      </div>
    </div>
  );
}
