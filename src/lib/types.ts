export type Method = "KO/TKO" | "SUBMISSION" | "DECISION";

export type Fighter = {
  id: string;
  name: string;
  nickname: string | null;
  photo_url: string | null;
  record: string | null;
  fightmatrix_rank: string | null;
  fightmatrix_score: number | null;
  nationality: string | null;
  flag_code: string | null;
};

export type Fight = {
  id: string;
  weight_class: string | null;
  is_title_fight: boolean;
  is_main_event: boolean;
  card_order: number;
  rounds: number;
  status: "scheduled" | "completed" | "cancelled" | "no_contest";
  winner_fighter_id: string | null;
  method: Method | null;
  result_round: number | null;
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
