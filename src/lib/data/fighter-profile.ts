import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCachedClient } from "@/lib/supabase/cached";
import { oktagonRecord } from "@/lib/fighter-history";
import type { Fighter, FighterHistoryEntry, FightStatsSide } from "@/lib/types";

const SAFETY_NET_SECONDS = 300;

const FIGHTER_COLUMNS =
  `id, oktagon_fighter_id, name, nickname, photo_url, fight_card_photo_url, bio, record,
   oktagon_rank, oktagon_rank_change, oktagon_slug, weight_kg, height_cm, birth_date,
   nationality, flag_code, is_tba`;

export type FighterSearchHit = Pick<
  Fighter,
  "id" | "name" | "nickname" | "photo_url" | "fight_card_photo_url" | "record" | "flag_code" | "nationality"
> & { fights: number };

/** What the tracking system logged across a whole career, not one night.
 * Sparse by nature: it only covers the fights it was actually running for,
 * so `fights` says how many of them these numbers rest on. */
export type CareerStats = FightStatsSide & { fights: number };

export type FighterProfile = {
  fighter: Fighter;
  history: FighterHistoryEntry[];
  career: CareerStats | null;
};

/** PostgREST puts the pattern straight into the query string, where a comma
 * or a parenthesis would end the filter early and the rest would be read as
 * more filters. Escaping them is not cosmetic - it is the difference between
 * a fruitless search and a syntax error thrown at the viewer. */
function likePattern(query: string): string {
  return `%${query.replace(/[%_,()\\]/g, (c) => `\\${c}`)}%`;
}

/** Strips diacritics the same way `fighters.search_name` does, so "vemola"
 * and "Vémola" hit the same rows. Doing it here as well as in the database
 * means the comparison is like-for-like rather than accidental. */
export function normalizeQuery(query: string): string {
  return query
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Fighters whose name or nickname contains the query, busiest first.
 *
 * Not cached: the query is per-keystroke and every result set would be its
 * own cache entry, which is a lot of storage to save a single indexed lookup.
 * Takes the caller's own client rather than making one - the search runs per
 * request under the viewer's session, so it has no business reaching for the
 * service role the cached fetchers below need.
 */
export async function searchFighters(
  supabase: SupabaseClient,
  query: string,
  limit = 30
): Promise<FighterSearchHit[]> {
  const normalized = normalizeQuery(query);
  if (normalized.length < 2) return [];

  const { data } = await supabase
    .from("fighters")
    .select(
      "id, name, nickname, photo_url, fight_card_photo_url, record, flag_code, nationality"
    )
    .eq("is_tba", false)
    .ilike("search_name", likePattern(normalized))
    .limit(limit);

  const fighters = (data ?? []) as unknown as Omit<FighterSearchHit, "fights">[];
  if (fighters.length === 0) return [];

  // How many OKTAGON fights each of them has - the one number that sorts a
  // name you recognise above a namesake who fought once in 2017.
  const { data: rows } = await supabase
    .from("fighter_oktagon_fights")
    .select("fighter_id")
    .in(
      "fighter_id",
      fighters.map((f) => f.id)
    );

  const counts = new Map<string, number>();
  for (const row of (rows ?? []) as { fighter_id: string }[]) {
    counts.set(row.fighter_id, (counts.get(row.fighter_id) ?? 0) + 1);
  }

  return fighters
    .map((fighter) => ({ ...fighter, fights: counts.get(fighter.id) ?? 0 }))
    .sort((a, b) => b.fights - a.fights || a.name.localeCompare(b.name, "cs"));
}

function blankSide(): FightStatsSide {
  return {
    hits: 0,
    significant_hits: 0,
    takedowns: 0,
    takedown_attempts: 0,
    submission_attempts: 0,
    targets: {},
  };
}

/** One fighter, everything we have: their row, every OKTAGON fight, and the
 * career totals the tracking system logged.
 *
 * Cached on the fighter, and busted by the same `fighter-<id>` tag the
 * history importer already fires (see the 20260745 migration), so a refreshed
 * history shows up without waiting out the safety net. */
export function getFighterProfile(fighterId: string) {
  return unstable_cache(
    async (): Promise<FighterProfile | null> => {
      const supabase = createCachedClient();

      const [{ data: fighter }, { data: history }] = await Promise.all([
        supabase.from("fighters").select(FIGHTER_COLUMNS).eq("id", fighterId).maybeSingle(),
        supabase
          .from("fighter_oktagon_fights")
          .select(
            `oktagon_fight_id, event_date, event_label, event_number, opponent_name,
             opponent_fighter_id, opponent_oktagon_fighter_id, opponent_slug, opponent_photo_url,
             outcome, result_type, end_round, end_time, title_fight, weight_class`
          )
          .eq("fighter_id", fighterId)
          .order("event_date", { ascending: false }),
      ]);

      if (!fighter) return null;

      return {
        fighter: fighter as unknown as Fighter,
        history: (history ?? []) as unknown as FighterHistoryEntry[],
        career: await careerStats(fighterId),
      };
    },
    ["fighter-profile", fighterId],
    { tags: [`fighter-${fighterId}`], revalidate: SAFETY_NET_SECONDS }
  )();
}

/** Career totals, summed from the per-fight rows.
 *
 * Which side of each fight this fighter was on decides which half of
 * `fight_stats` is theirs - reading the wrong one would hand them their
 * opponent's punches, so the fight rows are fetched for that alone. */
async function careerStats(fighterId: string): Promise<CareerStats | null> {
  const supabase = createCachedClient();

  const { data: fights } = await supabase
    .from("fights")
    .select("id, fighter_a_id")
    .or(`fighter_a_id.eq.${fighterId},fighter_b_id.eq.${fighterId}`);

  const sideOf = new Map(
    ((fights ?? []) as { id: string; fighter_a_id: string | null }[]).map((f) => [
      f.id,
      f.fighter_a_id === fighterId ? "a" : "b",
    ])
  );
  if (sideOf.size === 0) return null;

  const { data: stats } = await supabase
    .from("fight_stats")
    .select("*")
    .in("fight_id", Array.from(sideOf.keys()));

  const rows = (stats ?? []) as unknown as Record<string, unknown>[];
  if (rows.length === 0) return null;

  const total: CareerStats = { ...blankSide(), fights: 0 };
  for (const row of rows) {
    const prefix = `fighter_${sideOf.get(row.fight_id as string)}`;
    total.fights += 1;
    total.hits += Number(row[`${prefix}_hits`] ?? 0);
    total.significant_hits += Number(row[`${prefix}_significant_hits`] ?? 0);
    total.takedowns += Number(row[`${prefix}_takedowns`] ?? 0);
    total.takedown_attempts += Number(row[`${prefix}_takedown_attempts`] ?? 0);
    total.submission_attempts += Number(row[`${prefix}_submission_attempts`] ?? 0);
    const targets = (row[`${prefix}_targets`] as Record<string, number> | null) ?? {};
    for (const [area, count] of Object.entries(targets)) {
      total.targets[area] = (total.targets[area] ?? 0) + count;
    }
  }

  return total;
}

export { oktagonRecord };
