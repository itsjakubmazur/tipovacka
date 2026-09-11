import { describe, expect, it } from "vitest";
import {
  describeHistoryResult,
  findPreviousMeeting,
  formatOktagonRecord,
  oktagonRecord,
  recentForm,
} from "@/lib/fighter-history";
import type { FighterHistoryEntry } from "@/lib/types";

function entry(overrides: Partial<FighterHistoryEntry> = {}): FighterHistoryEntry {
  return {
    oktagon_fight_id: 1,
    event_date: "2026-05-16T16:00:00.000Z",
    event_label: "OKTAGON 88",
    event_number: 88,
    opponent_name: "Khalid Taha",
    opponent_fighter_id: null,
    opponent_oktagon_fighter_id: 872,
    opponent_slug: "khalid-taha",
    opponent_photo_url: null,
    outcome: "win",
    result_type: "TKO",
    end_round: 1,
    end_time: "3:14",
    title_fight: false,
    weight_class: "Featherweight",
    ...overrides,
  };
}

describe("oktagonRecord", () => {
  it("counts the promotion's own record, not the career one", () => {
    const record = oktagonRecord([
      entry({ outcome: "win" }),
      entry({ outcome: "win" }),
      entry({ outcome: "loss" }),
    ]);
    expect(record).toEqual({ win: 2, loss: 1, draw: 0, noContest: 0, total: 3 });
    expect(formatOktagonRecord(record)).toBe("2-1");
  });

  it("adds the draws column only when there is a draw", () => {
    expect(formatOktagonRecord(oktagonRecord([entry({ outcome: "draw" })]))).toBe("0-0-1");
  });

  it("keeps no contests out of the score but inside the total", () => {
    const record = oktagonRecord([entry({ outcome: "win" }), entry({ outcome: "no_contest" })]);
    expect(formatOktagonRecord(record)).toBe("1-0");
    expect(record.total).toBe(2);
  });

  it("handles a fighter making their promotional debut", () => {
    expect(formatOktagonRecord(oktagonRecord([]))).toBe("0-0");
  });
});

describe("describeHistoryResult", () => {
  it("names the round a finish happened in", () => {
    expect(describeHistoryResult(entry({ result_type: "SUB", end_round: 4 }))).toBe(
      "submise, 4. kolo"
    );
    expect(describeHistoryResult(entry({ result_type: "KO", end_round: 1 }))).toBe("KO, 1. kolo");
  });

  it("does not name a round for a decision", () => {
    // end_round is the last round fought, which for a decision is just the
    // scheduled length - saying "3. kolo" would read as a finish.
    expect(describeHistoryResult(entry({ result_type: "DEC", end_round: 3 }))).toBe("na body");
  });

  it("falls back to the outcome when there is nothing to describe", () => {
    expect(describeHistoryResult(entry({ outcome: "draw", result_type: "DEC" }))).toBe("remíza");
    expect(describeHistoryResult(entry({ outcome: "no_contest", result_type: null }))).toBe(
      "no contest"
    );
    expect(describeHistoryResult(entry({ result_type: null, end_round: null }))).toBe("—");
  });
});

describe("recentForm", () => {
  it("keeps the newest fights, in the order they came in", () => {
    const history = [1, 2, 3, 4, 5, 6].map((i) => entry({ oktagon_fight_id: i }));
    expect(recentForm(history).map((e) => e.oktagon_fight_id)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("findPreviousMeeting", () => {
  it("finds the bout these two have already had", () => {
    const history = [entry({ opponent_oktagon_fighter_id: 111 }), entry({ opponent_oktagon_fighter_id: 872 })];
    expect(findPreviousMeeting(history, 872)?.opponent_oktagon_fighter_id).toBe(872);
  });

  it("returns the most recent one when they have met more than once", () => {
    const history = [
      entry({ oktagon_fight_id: 20, opponent_oktagon_fighter_id: 872, outcome: "win" }),
      entry({ oktagon_fight_id: 10, opponent_oktagon_fighter_id: 872, outcome: "loss" }),
    ];
    expect(findPreviousMeeting(history, 872)?.oktagon_fight_id).toBe(20);
  });

  it("does not count tonight's own fight once it has been graded", () => {
    // After the gala, this very bout is in both fighters' history - and it is
    // not a rematch of itself.
    const tonight = entry({ event_date: "2026-09-12T18:00:00.000Z", opponent_oktagon_fighter_id: 872 });
    expect(findPreviousMeeting([tonight], 872, "2026-09-12T18:00:00.000Z")).toBeNull();

    const earlier = entry({ event_date: "2025-01-01T18:00:00.000Z", opponent_oktagon_fighter_id: 872 });
    expect(findPreviousMeeting([tonight, earlier], 872, "2026-09-12T18:00:00.000Z")).toBe(earlier);
  });

  it("says nothing when the opponent has no OKTAGON id to match on", () => {
    // A TBA slot, or a fighter row that predates the OKTAGON import.
    expect(findPreviousMeeting([entry()], null)).toBeNull();
    expect(findPreviousMeeting([entry()], undefined)).toBeNull();
  });
});
