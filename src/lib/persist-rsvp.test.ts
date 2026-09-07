import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const from = vi.fn(() => ({ upsert }));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));

const { persistRsvp } = await import("./persist-rsvp");

/** Líný thenable, jako se chová PostgREST builder: request se odešle teprve
 * když na něm někdo zavolá `then()`. */
function lazyBuilder() {
  const state = { executed: false };
  return {
    state,
    builder: {
      then(onFulfilled: (value: { error: null }) => unknown) {
        state.executed = true;
        return Promise.resolve({ error: null }).then(onFulfilled);
      },
    },
  };
}

beforeEach(() => {
  upsert.mockReset();
  from.mockClear();
});

describe("persistRsvp", () => {
  it("request opravdu odešle, nezahodí líný builder", async () => {
    const { state, builder } = lazyBuilder();
    upsert.mockReturnValue(builder);

    await persistRsvp({ eventId: "e1", userId: "u1", answer: "no", plusOnes: 0 });

    // regrese: `void supabase.from(...).upsert(...)` tohle nechá na false a
    // odpověď se nikam neuloží, i když v UI vypadá zaznačeně
    expect(state.executed).toBe(true);
  });

  it("píše do watch_party_rsvps a řeší konflikt přes složený klíč", async () => {
    const { builder } = lazyBuilder();
    upsert.mockReturnValue(builder);

    await persistRsvp({ eventId: "e1", userId: "u1", answer: "yes", plusOnes: 2 });

    expect(from).toHaveBeenCalledWith("watch_party_rsvps");
    expect(upsert).toHaveBeenCalledWith(
      { event_id: "e1", user_id: "u1", answer: "yes", plus_ones: 2 },
      { onConflict: "event_id,user_id" }
    );
  });
});
