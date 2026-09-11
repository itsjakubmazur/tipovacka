import type { FighterHistoryEntry, HistoryOutcome } from "@/lib/types";

/** OKTAGON's own end types, kept raw in the DB so a history list can say KO
 * where our three-way scoring `method` only knows "KO/TKO". */
export const RESULT_TYPE_LABELS: Record<string, string> = {
  KO: "KO",
  TKO: "TKO",
  SUB: "submise",
  DEC: "na body",
};

export const OUTCOME_LABELS: Record<HistoryOutcome, string> = {
  win: "výhra",
  loss: "prohra",
  draw: "remíza",
  no_contest: "no contest",
};

/** W-P-R in the promotion, which is a different number from the career
 * record OKTAGON prints on the fighter's card. */
export type OktagonRecord = {
  win: number;
  loss: number;
  draw: number;
  noContest: number;
  total: number;
};

export function oktagonRecord(history: FighterHistoryEntry[]): OktagonRecord {
  const record: OktagonRecord = { win: 0, loss: 0, draw: 0, noContest: 0, total: history.length };
  for (const entry of history) {
    if (entry.outcome === "no_contest") record.noContest += 1;
    else record[entry.outcome] += 1;
  }
  return record;
}

/** "4-1" normally, "4-1-1" once there is a draw to report - the same shape
 * OKTAGON uses, so it reads next to the career record without explanation.
 * No-contests are left out of the score on purpose: they are not results. */
export function formatOktagonRecord(record: OktagonRecord): string {
  const base = `${record.win}-${record.loss}`;
  return record.draw > 0 ? `${base}-${record.draw}` : base;
}

/** Newest first, which is how form is read. */
export function recentForm(history: FighterHistoryEntry[], limit = 5): FighterHistoryEntry[] {
  return history.slice(0, limit);
}

/** "TKO, 1. kolo" / "na body" / "remíza" - one line describing how a fight
 * ended, from nothing but what the API gives us. */
export function describeHistoryResult(entry: FighterHistoryEntry): string {
  if (entry.outcome === "draw" || entry.outcome === "no_contest") {
    return OUTCOME_LABELS[entry.outcome];
  }
  const method = entry.result_type ? RESULT_TYPE_LABELS[entry.result_type] ?? entry.result_type : null;
  // A decision is by definition the full distance, so naming the round it
  // "ended" in is noise - it is the same number every time.
  if (!method) return entry.end_round ? `${entry.end_round}. kolo` : "—";
  if (entry.result_type === "DEC" || !entry.end_round) return method;
  return `${method}, ${entry.end_round}. kolo`;
}

/** The one fight in this fighter's history against a given opponent, if they
 * have already met in OKTAGON. Newest first in, so a third bout returns the
 * most recent one.
 *
 * Matching is on OKTAGON's fighter id rather than our own uuid, because an
 * opponent only gets a `fighters` row once they turn up on a card the group
 * actually tipped - the history itself goes back much further. */
export function findPreviousMeeting(
  history: FighterHistoryEntry[],
  opponentOktagonId: number | null | undefined,
  /** Only count galas before this one. Once tonight's card is graded, the
   * bout itself lands in both fighters' history - without this cut-off a
   * fight would announce itself as its own rematch. */
  before?: string
): FighterHistoryEntry | null {
  if (opponentOktagonId == null) return null;
  const cutoff = before ? new Date(before).getTime() : null;
  return (
    history.find(
      (entry) =>
        entry.opponent_oktagon_fighter_id === opponentOktagonId &&
        (cutoff === null || new Date(entry.event_date).getTime() < cutoff)
    ) ?? null
  );
}
