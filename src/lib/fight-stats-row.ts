import type { FightStats, FightStatsSide } from "@/lib/types";

/** A `fight_stats` row as PostgREST hands it over: two flat sets of counters
 * prefixed by side, plus the per-round breakdown as jsonb. */
export type FightStatsRow = {
  fight_id: string;
  rounds: FightStats["rounds"];
} & Record<string, unknown>;

function side(row: FightStatsRow, prefix: "fighter_a" | "fighter_b"): FightStatsSide {
  return {
    hits: Number(row[`${prefix}_hits`] ?? 0),
    significant_hits: Number(row[`${prefix}_significant_hits`] ?? 0),
    takedowns: Number(row[`${prefix}_takedowns`] ?? 0),
    takedown_attempts: Number(row[`${prefix}_takedown_attempts`] ?? 0),
    submission_attempts: Number(row[`${prefix}_submission_attempts`] ?? 0),
    targets: (row[`${prefix}_targets`] as Record<string, number> | null) ?? {},
  };
}

/** Flat row -> the a/b shape every stats component takes.
 *
 * Shared rather than written out per caller: the card on a gala page and the
 * one that unfolds inside a fighter's record read the same row, and a counter
 * added on one side only would quietly show up in one place and not the
 * other. */
export function fightStatsFromRow(row: FightStatsRow): FightStats {
  return {
    fight_id: row.fight_id,
    a: side(row, "fighter_a"),
    b: side(row, "fighter_b"),
    rounds: Array.isArray(row.rounds) ? row.rounds : [],
  };
}
