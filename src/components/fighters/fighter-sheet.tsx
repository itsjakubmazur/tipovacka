"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/modal";
import { FighterIdentity } from "@/components/fighters/fighter-identity";
import { FighterHistoryList } from "@/components/fighters/fighter-history-list";
import { oktagonRecord } from "@/lib/fighter-history";
import type { Fighter, FighterHistoryEntry } from "@/lib/types";

/** Everything we know about one fighter, on top of the card rather than on a
 * page of its own: bio, record in the promotion, and every OKTAGON fight
 * they have had - which is more than oktagonmma.com's own profile shows.
 *
 * The history is fetched when the sheet opens rather than shipped with the
 * fight card: ten cards on a phone would otherwise carry two hundred rows
 * nobody asked to see.
 *
 * Renders the same blocks as /fighters/[id] - the sheet is the same profile
 * with less room, not a second design of it. */
export function FighterSheet({ fighter, onClose }: { fighter: Fighter; onClose: () => void }) {
  const supabase = createClient();
  const [history, setHistory] = useState<FighterHistoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("fighter_oktagon_fights")
        .select(
          `oktagon_fight_id, event_date, event_label, event_number, opponent_name,
           opponent_fighter_id, opponent_oktagon_fighter_id, opponent_slug, opponent_photo_url,
           outcome, result_type, end_round, end_time, title_fight, weight_class`
        )
        .eq("fighter_id", fighter.id)
        .order("event_date", { ascending: false });
      if (cancelled) return;
      if (error) {
        setFailed(true);
        return;
      }
      setHistory((data ?? []) as unknown as FighterHistoryEntry[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, fighter.id]);

  const record = history ? oktagonRecord(history) : null;

  return (
    <Modal onClose={onClose}>
      <FighterIdentity
        fighter={fighter}
        history={history}
        record={record}
        className="pr-8"
      />

      {fighter.bio && (
        <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{fighter.bio}</p>
      )}

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Zápasy v OKTAGONU
        </h3>

        {history === null && !failed && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Načítám…</p>
        )}
        {failed && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Historii se nepodařilo načíst.
          </p>
        )}
        {history && history.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Tady zatím nic — buď je to jeho premiéra v OKTAGONU, nebo se historie ještě nestihla
            natáhnout.
          </p>
        )}

        {history && history.length > 0 && <FighterHistoryList history={history} />}
      </div>

      {/* Ven z dialogu až na konec: kdo si rozklikl bojovníka uprostřed
          tipování, většinou chtěl jen mrknout na formu a vrátit se ke kartě.
          Kdo chce víc - statistiky kariéry, proklik na soupeře - najde cestu
          tady, ne místo toho, co si otevřel. */}
      <Link
        href={`/fighters/${fighter.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-yellow-600 outline-none transition-colors hover:text-yellow-700 focus-visible:ring-2 focus-visible:ring-accent dark:text-accent dark:hover:text-yellow-300"
      >
        Celý profil bojovníka
        <ArrowRight className="size-4" />
      </Link>
    </Modal>
  );
}
