import { describe, expect, it } from "vitest";
import {
  MAX_PLUS_ONES,
  answerFor,
  choiceOf,
  detailLine,
  headline,
  namesOf,
  summarize,
  type WatchPartyRow,
} from "./watch-party";

const ME = "me";

function row(partial: Partial<WatchPartyRow> & { userId: string }): WatchPartyRow {
  return { nickname: partial.userId, answer: "yes", plusOnes: 0, ...partial };
}

describe("choiceOf", () => {
  it("splits 'yes' into coming alone and coming with someone", () => {
    expect(choiceOf(null)).toBe(null);
    expect(choiceOf({ answer: "yes", plusOnes: 0 })).toBe("alone");
    expect(choiceOf({ answer: "yes", plusOnes: 2 })).toBe("plus");
    expect(choiceOf({ answer: "maybe", plusOnes: 0 })).toBe("maybe");
    expect(choiceOf({ answer: "no", plusOnes: 0 })).toBe("no");
  });
});

describe("answerFor", () => {
  it("starts 'with someone' at one guest and keeps a count you already had", () => {
    expect(answerFor("plus", 0)).toEqual({ answer: "yes", plusOnes: 1 });
    expect(answerFor("plus", 3)).toEqual({ answer: "yes", plusOnes: 3 });
  });

  it("never goes past the count the DB check allows", () => {
    expect(answerFor("plus", 99)).toEqual({ answer: "yes", plusOnes: MAX_PLUS_ONES });
  });

  it("clears the guest count on every other answer, so it can't come back later", () => {
    expect(answerFor("alone", 3)).toEqual({ answer: "yes", plusOnes: 0 });
    expect(answerFor("maybe", 3)).toEqual({ answer: "maybe", plusOnes: 0 });
    expect(answerFor("no", 3)).toEqual({ answer: "no", plusOnes: 0 });
  });
});

describe("summarize", () => {
  it("counts each 'yes' as themselves plus whoever they bring", () => {
    const summary = summarize([
      row({ userId: "a", plusOnes: 2 }),
      row({ userId: "b" }),
      row({ userId: "c", answer: "maybe" }),
      row({ userId: "d", answer: "no" }),
    ]);
    expect(summary.headcount).toBe(4);
    expect(summary.guests).toBe(2);
    expect(summary.yes).toHaveLength(2);
    expect(summary.maybe).toHaveLength(1);
    expect(summary.no).toHaveLength(1);
  });

  it("does not count guests of people who aren't coming", () => {
    // the DB check forbids storing this, but a stale row must not inflate the count
    const summary = summarize([row({ userId: "a", answer: "maybe", plusOnes: 3 })]);
    expect(summary.headcount).toBe(0);
    expect(summary.guests).toBe(0);
  });
});

describe("headline", () => {
  it("speaks to you directly when you are the only one going", () => {
    const summary = summarize([row({ userId: ME, nickname: "Kuba" })]);
    expect(headline(summary, ME, false)).toBe("Zatím jdeš jenom ty.");
    expect(headline(summary, "someone-else", false)).toBe("Zatím dorazí jenom Kuba.");
  });

  it("counts guests into 'bude nás', not just app users", () => {
    const summary = summarize([row({ userId: ME, plusOnes: 2 })]);
    expect(headline(summary, ME, false)).toBe("Bude nás 3.");
  });

  it("says nobody signed up when every answer is no", () => {
    const summary = summarize([row({ userId: "a", answer: "no" }), row({ userId: "b", answer: "maybe" })]);
    expect(headline(summary, ME, false)).toBe("Zatím se nikdo nepřihlásil.");
  });

  it("switches to past tense once the gala is graded", () => {
    const summary = summarize([row({ userId: "a" }), row({ userId: "b" })]);
    expect(headline(summary, ME, true)).toBe("V garáži nás bylo 2.");
    expect(headline(summarize([]), ME, true)).toBe("Do garáže nakonec nikdo nedorazil.");
    expect(headline(summarize([row({ userId: ME })]), ME, true)).toBe("V garáži jsi byl jenom ty.");
  });
});

describe("detailLine", () => {
  it("leaves out empty groups instead of printing zeroes", () => {
    expect(detailLine(summarize([row({ userId: "a", plusOnes: 2 }), row({ userId: "b" })]))).toBe(
      "2 dorazí (+2)"
    );
    expect(detailLine(summarize([row({ userId: "a", answer: "no" })]))).toBe("1 ne");
    expect(detailLine(summarize([]))).toBe(null);
  });

  it("lists the groups in the order the buttons are in", () => {
    const summary = summarize([
      row({ userId: "a" }),
      row({ userId: "b", answer: "maybe" }),
      row({ userId: "c", answer: "no" }),
    ]);
    expect(detailLine(summary)).toBe("1 dorazí · 1 možná · 1 ne");
  });
});

describe("namesOf", () => {
  it("writes the guests next to whoever is bringing them", () => {
    expect(namesOf([row({ userId: "a", nickname: "Rejdoš", plusOnes: 2 }), row({ userId: "b", nickname: "Kuba" })])).toBe(
      "Rejdoš +2, Kuba"
    );
  });
});
