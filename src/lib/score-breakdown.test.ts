import { describe, expect, it } from "vitest";
import { extraTagsForTable } from "./revalidate-tags";
import { isPublicPath } from "./auth-paths";
import { pointsLabel, scoreBreakdown } from "./score-breakdown";
import type { Fight, Prediction } from "./types";

const fight = {
  id: "f1",
  winner_fighter_id: "a",
  method: "KO/TKO",
  result_round: 2,
  fighter_a: { id: "a", name: "Jan Novak" },
  fighter_b: { id: "b", name: "Petr Svoboda" },
} as unknown as Fight;

describe("scoreBreakdown", () => {
  it("names a miss with the actual winner", () => {
    const prediction = {
      fight_id: "f1",
      predicted_winner_id: "b",
      predicted_method: "DECISION",
      predicted_round: null,
      points: 0,
    } satisfies Prediction;
    expect(scoreBreakdown(fight, prediction)).toContain("vyhrál Novak");
  });

  it("names a full hit", () => {
    const prediction = {
      fight_id: "f1",
      predicted_winner_id: "a",
      predicted_method: "KO/TKO",
      predicted_round: 2,
      points: 3,
    } satisfies Prediction;
    expect(scoreBreakdown(fight, prediction)).toBe("Vítěz, způsob i kolo");
  });
});

describe("pointsLabel", () => {
  it("doubles a jistotka", () => {
    expect(pointsLabel(3, true)).toBe("+6 b. (×2)");
  });
});

describe("extraTagsForTable", () => {
  it("fans out fight writes to the events list", () => {
    expect(extraTagsForTable("fights", "event-abc")).toEqual(["events-list", "leaderboard-global"]);
  });

  it("fans out predictions to the event board", () => {
    expect(extraTagsForTable("predictions", "event-abc")).toEqual([
      "leaderboard-event-abc",
      "leaderboard-global",
      "hall-of-fame",
    ]);
  });
});

describe("isPublicPath", () => {
  it("keeps login and share public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/share/card")).toBe(true);
    expect(isPublicPath("/api/cron-tick")).toBe(true);
  });

  it("gates the private card", () => {
    expect(isPublicPath("/events")).toBe(false);
    expect(isPublicPath("/profile")).toBe(false);
  });
});
