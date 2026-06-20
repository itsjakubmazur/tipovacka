export type Method = "KO/TKO" | "SUBMISSION" | "DECISION";

export type Fighter = {
  id: string;
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
};
