export type Method = "KO/TKO" | "SUBMISSION" | "DECISION";

export type Fighter = {
  id: string;
  /** OKTAGON's own id - the key their API, and therefore a fighter's whole
   * fight history, is keyed on. Null only for a TBA placeholder. */
  oktagon_fighter_id: number | null;
  name: string;
  nickname: string | null;
  photo_url: string | null;
  fight_card_photo_url: string | null;
  bio: string | null;
  record: string | null;
  oktagon_rank: string | null;
  oktagon_rank_change: number | null;
  oktagon_slug: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  birth_date: string | null;
  nationality: string | null;
  flag_code: string | null;
  is_tba: boolean;
};

export type Fight = {
  id: string;
  weight_class: string | null;
  is_title_fight: boolean;
  is_main_event: boolean;
  card_order: number;
  card_segment: "main_card" | "prelims" | "free_prelims" | null;
  rounds: number;
  status: "scheduled" | "completed" | "cancelled" | "no_contest";
  winner_fighter_id: string | null;
  method: Method | null;
  result_round: number | null;
  result_time: string | null;
  odds_fighter_a: number | null;
  odds_fighter_b: number | null;
  fighter_a: Fighter;
  fighter_b: Fighter;
};

export type Prediction = {
  fight_id: string;
  predicted_winner_id: string;
  predicted_method: Method;
  predicted_round: number | null;
  points: number | null;
  /** maintained by a trigger - "when did I last touch this tip", which is the
   * question people ask themselves in the last hour before lock */
  updated_at?: string | null;
};

export type HistoryOutcome = "win" | "loss" | "draw" | "no_contest";

/** One past OKTAGON fight, seen from one fighter's side. Display only - it
 * never touches scoring, which is why it lives in its own table rather than
 * in `fights` (see docs/shape-fighter-history.md). */
export type FighterHistoryEntry = {
  oktagon_fight_id: number;
  event_date: string;
  event_label: string;
  event_number: number | null;
  opponent_name: string;
  opponent_fighter_id: string | null;
  opponent_oktagon_fighter_id: number | null;
  opponent_slug: string | null;
  opponent_photo_url: string | null;
  outcome: HistoryOutcome;
  /** OKTAGON's raw end type: "KO" | "TKO" | "SUB" | "DEC" */
  result_type: string | null;
  /** the round the fight ENDED in, not how long it was scheduled for */
  end_round: number | null;
  end_time: string | null;
  title_fight: boolean;
  weight_class: string | null;
};

/** Totals logged by the external fight-tracking system. Sparse by nature:
 * nothing before roughly mid-2024 has any, and a given fight may simply be
 * missing from it. */
export type FightStatsSide = {
  hits: number;
  significant_hits: number;
  takedowns: number;
  takedown_attempts: number;
  submission_attempts: number;
};

export type FightStats = {
  fight_id: string;
  a: FightStatsSide;
  b: FightStatsSide;
  rounds: { round: number; a: FightStatsSide; b: FightStatsSide }[];
};
