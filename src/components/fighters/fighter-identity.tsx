import Image from "next/image";
import { FighterForm } from "@/components/fighters/fighter-form";
import { formatOktagonRecord, recentForm, type OktagonRecord } from "@/lib/fighter-history";
import { cn } from "@/lib/utils";
import type { Fighter, FighterHistoryEntry } from "@/lib/types";

/** Photo, flag, name, nickname and the two records - the block that says
 * *who this is*, wherever it appears.
 *
 * Shared by the sheet on a fight card and the fighter's own page on purpose:
 * they show the same fighter and used to be one copy-paste apart from
 * drifting. `size` is the only difference between them, because a modal
 * opened over a card has less room than a page that is only this. */
export function FighterIdentity({
  fighter,
  history,
  record,
  size = "sm",
  className,
}: {
  fighter: Pick<
    Fighter,
    "name" | "nickname" | "photo_url" | "fight_card_photo_url" | "record" | "flag_code" | "nationality" | "oktagon_rank"
  >;
  /** null while it is still loading - the records simply stay out until it
   * arrives, rather than flashing a zero */
  history: FighterHistoryEntry[] | null;
  record: OktagonRecord | null;
  size?: "sm" | "lg";
  className?: string;
}) {
  const photo = fighter.photo_url ?? fighter.fight_card_photo_url;
  const large = size === "lg";

  return (
    <div className={cn("flex items-start gap-3", className)}>
      {photo && (
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-full bg-black/5 dark:bg-white/5",
            large ? "size-20 lg:size-24" : "size-16"
          )}
        >
          <Image
            src={photo}
            alt={fighter.name}
            fill
            sizes={large ? "96px" : "64px"}
            className="object-cover object-top"
          />
        </div>
      )}
      <div className="min-w-0">
        <h2
          className={cn(
            "flex items-center gap-2 font-extrabold uppercase leading-tight tracking-tight",
            large ? "text-xl lg:text-2xl" : "text-lg"
          )}
        >
          {fighter.flag_code && (
            <Image
              src={`https://flagcdn.com/h20/${fighter.flag_code}.png`}
              alt={fighter.nationality ?? ""}
              width={20}
              height={14}
              unoptimized
              className="h-auto w-5 shrink-0"
            />
          )}
          <span className="truncate">{fighter.name}</span>
        </h2>
        {fighter.nickname && (
          <p className="text-xs italic text-neutral-500 dark:text-neutral-400">
            {`„${fighter.nickname}“`}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
          {fighter.oktagon_rank && <span>{fighter.oktagon_rank}</span>}
          {fighter.record && (
            <span>
              Kariéra{" "}
              <span className="font-bold tabular-nums text-black dark:text-white">
                {fighter.record}
              </span>
            </span>
          )}
          {record && record.total > 0 && (
            <span>
              V OKTAGONU{" "}
              <span className="font-bold tabular-nums text-black dark:text-white">
                {formatOktagonRecord(record)}
              </span>
            </span>
          )}
        </div>
        {history && history.length > 0 && <FighterForm form={recentForm(history)} className="mt-2" />}
      </div>
    </div>
  );
}
