import { METHOD_LABELS } from "@/lib/method-labels";
import type { Fight, Prediction } from "@/lib/types";

/** What a tip's points are actually for.
 *
 * "Trefa" told you nothing the number next to it didn't; this names which of
 * the three parts landed, and on a miss, who won instead.
 *
 * Mirrors calculate_points exactly - including that on a decision the third
 * point is for leaving the round empty, and that it is the *actual* method
 * that decides which rule applies, not the predicted one. */
export function scoreBreakdown(fight: Fight, prediction: Prediction | null): string {
  const hit = (prediction?.points ?? 0) > 0;
  if (!prediction) return hit ? "Trefa" : "Netrefeno";

  if (prediction.predicted_winner_id !== fight.winner_fighter_id) {
    const winner =
      fight.winner_fighter_id === fight.fighter_a.id
        ? fight.fighter_a
        : fight.winner_fighter_id === fight.fighter_b.id
          ? fight.fighter_b
          : null;
    const surname = winner?.name.split(" ").pop();
    if (!surname) return "Netrefeno";
    const how = fight.method ? METHOD_LABELS[fight.method] : null;
    return how ? `Netrefeno · vyhrál ${surname} (${how})` : `Netrefeno · vyhrál ${surname}`;
  }

  const decision = fight.method === "DECISION";
  const methodOk = prediction.predicted_method === fight.method;
  const roundOk = decision
    ? prediction.predicted_round == null
    : prediction.predicted_round === fight.result_round;

  if (decision) {
    if (methodOk && roundOk) return "Vítěz i způsob · na body";
    if (methodOk) return "Vítěz a způsob";
    if (roundOk) return "Vítěz · na body";
    return "Jen vítěz";
  }
  if (methodOk && roundOk) return "Vítěz, způsob i kolo";
  if (methodOk) return "Vítěz a způsob";
  if (roundOk) return "Vítěz a kolo";
  return "Jen vítěz";
}

/** A fight's points as the leaderboard counts them - jistotka doubles. */
export function pointsLabel(points: number | null | undefined, isBold?: boolean): string {
  if (points == null) return "—";
  if (points <= 0) return "0 b.";
  return isBold ? `+${points * 2} b. (×2)` : `+${points} b.`;
}
