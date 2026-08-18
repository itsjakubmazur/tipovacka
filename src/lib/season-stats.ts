import type { createClient } from "@/lib/supabase/server";
import type { Method } from "@/lib/types";
import { STARTOVNE_CZK } from "@/lib/startovne";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const NO_MATCH = "00000000-0000-0000-0000-000000000000";

export type SeasonEvent = {
  id: string;
  label: string;
  subtitle: string | null;
  date: string;
  imageUrl: string | null;
};

export type Night = {
  event: SeasonEvent;
  points: number;
  rank: number | null;
  participants: number;
  perfectCard: boolean;
  fightsScored: number;
  fightsCompleted: number;
};

export type Tally = { total: number; hits: number };

export type SeasonStats = {
  season: number;
  /** every non-draft gala of the season, newest first */
  events: SeasonEvent[];
  /** the ones this tipper actually played, oldest first */
  nights: Night[];
  totalPoints: number;
  seasonRank: number | null;
  seasonTotal: number | null;
  eventWins: number;
  perfectCards: number;

  totalGraded: number;
  hits: number;
  accuracy: number;
  exactHits: number;
  /** current run of correct calls, counting back from the latest fight */
  streak: number;
  /** longest such run anywhere in the season */
  longestStreak: number;
  mainEventStreak: number;

  methodStats: Map<Method, Tally>;
  segmentStats: Map<string, Tally>;
  favoriteStats: Tally;
  underdogStats: Tally;
  oddsClassified: number;
  underdogShare: number;

  boldTotal: number;
  boldHits: number;
  boldUnderdogHits: number;
  soloHits: number;
  /** the loneliest correct call of the season */
  topSolo: { fighterName: string; share: number; eventLabel: string } | null;

  fotnTotal: number;
  fotnHits: number;

  best: Night | null;
  worst: Night | null;

  /** median minutes between a tipper's first tip on a gala and its lock */
  medianMinutesBeforeLock: number | null;
  lastMinuteEvents: number;

  comments: {
    count: number;
    topEmoji: string | null;
    topReacted: { body: string; count: number } | null;
    gifs: number;
  };

  nemesis: { nickname: string; wins: number; losses: number } | null;

  balance: number | null;
};

type RankableRow = {
  user_id: string;
  points: number;
  fights_correct_winner: number;
  perfect_card: boolean;
  earliest_prediction_at: string | null;
};

/** The leaderboard's tiebreak chain, in one place - every caller that ranks a
 * gala client-side has to use exactly this or the standings disagree with the
 * board people are looking at. */
export function rankOrder(a: RankableRow, b: RankableRow): number {
  return (
    b.points - a.points ||
    b.fights_correct_winner - a.fights_correct_winner ||
    Number(b.perfect_card) - Number(a.perfect_card) ||
    (a.earliest_prediction_at ?? "").localeCompare(b.earliest_prediction_at ?? "")
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Everything the app knows about one tipper's season, computed once.
 *
 * This used to live inline in the tipper detail page while Wrapped kept its
 * own thinner copy, so the two disagreed about the same season. Both read
 * from here now. */
export async function loadSeasonStats(
  supabase: Supabase,
  userId: string,
  season: number
): Promise<SeasonStats> {
  const { data: seasonEventRows } = await supabase
    .from("events")
    .select("id, number, name, subtitle, event_date, image_url, status, lock_at, payouts_enabled")
    .neq("status", "draft")
    .order("event_date", { ascending: false });

  const inSeason = (seasonEventRows ?? []).filter(
    (e) => new Date(e.event_date).getFullYear() === season
  );
  const events: SeasonEvent[] = inSeason.map((e) => ({
    id: e.id,
    label: e.number ? `OKTAGON ${e.number}` : e.name,
    subtitle: e.subtitle ?? null,
    date: e.event_date,
    imageUrl: e.image_url ?? null,
  }));
  const eventById = new Map(events.map((e) => [e.id, e]));
  const lockAtById = new Map(inSeason.map((e) => [e.id, e.lock_at as string | null]));
  const payoutsById = new Map(inSeason.map((e) => [e.id, Boolean(e.payouts_enabled)]));
  const eventIds = inSeason.map((e) => e.id);
  const eventFilter = eventIds.length ? eventIds : [NO_MATCH];

  const [
    { data: myRows },
    { data: allRows },
    { data: completedFights },
    { data: seasonRows },
    { data: myBonus },
    { data: myComments },
  ] = await Promise.all([
    supabase
      .from("event_leaderboard")
      .select("event_id, points, fights_scored, fights_completed, perfect_card")
      .eq("user_id", userId)
      .in("event_id", eventFilter),
    supabase
      .from("event_leaderboard")
      .select(
        "event_id, user_id, nickname, points, fights_correct_winner, perfect_card, earliest_prediction_at"
      )
      .in("event_id", eventFilter),
    supabase
      .from("fights")
      .select(
        "id, event_id, card_order, card_segment, is_main_event, fighter_a_id, fighter_b_id, odds_fighter_a, odds_fighter_b"
      )
      .in("event_id", eventFilter)
      .eq("status", "completed"),
    supabase
      .from("season_leaderboard")
      .select("user_id, points, fights_correct_winner, perfect_cards, earliest_prediction_at")
      .eq("season", season)
      .order("points", { ascending: false })
      .order("fights_correct_winner", { ascending: false })
      .order("perfect_cards", { ascending: false })
      .order("earliest_prediction_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("bonus_predictions")
      .select("event_id, points, created_at")
      .eq("user_id", userId)
      .in("event_id", eventFilter),
    supabase
      .from("event_comments")
      .select("id, body, gif_url, event_comment_reactions(emoji)")
      .eq("user_id", userId)
      .in("event_id", eventFilter),
  ]);

  const myRowByEvent = new Map((myRows ?? []).map((r) => [r.event_id, r]));
  const totalPoints = (myRows ?? []).reduce((sum, r) => sum + r.points, 0);

  const rowsByEvent = new Map<string, typeof allRows>();
  for (const row of allRows ?? []) {
    const list = rowsByEvent.get(row.event_id) ?? [];
    list!.push(row);
    rowsByEvent.set(row.event_id, list);
  }

  // per-gala standing, event wins, head-to-head record and the money
  const nights: Night[] = [];
  let eventWins = 0;
  let balance = 0;
  let playedForMoney = false;
  const h2h = new Map<string, { nickname: string; wins: number; losses: number }>();

  for (const event of [...events].reverse()) {
    const list = rowsByEvent.get(event.id);
    if (!list || list.length === 0) continue;
    const ranked = [...list].sort(rankOrder);
    const myIndex = ranked.findIndex((r) => r.user_id === userId);
    if (myIndex < 0) continue;

    const myRow = myRowByEvent.get(event.id);
    nights.push({
      event,
      points: ranked[myIndex].points,
      rank: ranked.length > 1 ? myIndex + 1 : null,
      participants: ranked.length,
      perfectCard: Boolean(myRow?.perfect_card ?? ranked[myIndex].perfect_card),
      fightsScored: myRow?.fights_scored ?? 0,
      fightsCompleted: myRow?.fights_completed ?? 0,
    });

    const iWon = ranked.length > 1 && ranked[0].user_id === userId;
    if (iWon) eventWins += 1;
    if (payoutsById.get(event.id)) {
      playedForMoney = true;
      balance += iWon ? (ranked.length - 1) * STARTOVNE_CZK : -STARTOVNE_CZK;
    }

    for (let i = 0; i < ranked.length; i += 1) {
      const other = ranked[i];
      if (other.user_id === userId) continue;
      const entry = h2h.get(other.user_id) ?? {
        nickname: other.nickname ?? "Bez přezdívky",
        wins: 0,
        losses: 0,
      };
      if (i > myIndex) entry.wins += 1;
      else entry.losses += 1;
      h2h.set(other.user_id, entry);
    }
  }

  const seasonIndex = (seasonRows ?? []).findIndex((r) => r.user_id === userId);

  // The rival you split the season with - most galas contested, then the
  // tightest record. A 6-5 across every gala is a story; 1-0 isn't.
  let nemesis: SeasonStats["nemesis"] = null;
  for (const entry of h2h.values()) {
    const played = entry.wins + entry.losses;
    if (played < 2) continue;
    const margin = Math.abs(entry.wins - entry.losses);
    if (
      !nemesis ||
      played > nemesis.wins + nemesis.losses ||
      (played === nemesis.wins + nemesis.losses &&
        margin < Math.abs(nemesis.wins - nemesis.losses))
    ) {
      nemesis = entry;
    }
  }

  // ---- fight-level stats -------------------------------------------------
  const fightMeta = new Map(
    (completedFights ?? []).map((f) => [
      f.id,
      {
        eventId: f.event_id,
        eventDate: eventById.get(f.event_id)?.date ?? "",
        cardOrder: f.card_order,
        cardSegment: f.card_segment as string | null,
        isMainEvent: Boolean(f.is_main_event),
        fighterAId: f.fighter_a_id,
        fighterBId: f.fighter_b_id,
        oddsA: f.odds_fighter_a as number | null,
        oddsB: f.odds_fighter_b as number | null,
      },
    ])
  );
  const fightFilter = fightMeta.size ? [...fightMeta.keys()] : [NO_MATCH];

  const [{ data: myPredictions }, { data: boldPicks }, { data: allPicks }] = await Promise.all([
    supabase
      .from("predictions")
      .select("fight_id, predicted_winner_id, predicted_method, points")
      .eq("user_id", userId)
      .in("fight_id", fightFilter),
    supabase.from("bold_picks").select("fight_id").eq("user_id", userId).in("event_id", eventFilter),
    // everyone's winner picks, to see which correct calls went against the room
    supabase
      .from("predictions")
      .select("fight_id, predicted_winner_id")
      .in("fight_id", fightFilter),
  ]);

  const boldFightIds = new Set((boldPicks ?? []).map((b) => b.fight_id));
  const pickCounts = new Map<string, { total: number; byFighter: Map<string, number> }>();
  for (const p of allPicks ?? []) {
    const entry = pickCounts.get(p.fight_id) ?? { total: 0, byFighter: new Map<string, number>() };
    entry.total += 1;
    entry.byFighter.set(
      p.predicted_winner_id,
      (entry.byFighter.get(p.predicted_winner_id) ?? 0) + 1
    );
    pickCounts.set(p.fight_id, entry);
  }

  const ordered = (myPredictions ?? [])
    .filter((p) => fightMeta.has(p.fight_id))
    .sort((a, b) => {
      const metaA = fightMeta.get(a.fight_id)!;
      const metaB = fightMeta.get(b.fight_id)!;
      const dateDiff = new Date(metaA.eventDate).getTime() - new Date(metaB.eventDate).getTime();
      return dateDiff !== 0 ? dateDiff : metaA.cardOrder - metaB.cardOrder;
    });

  const totalGraded = ordered.length;
  const hits = ordered.filter((p) => (p.points ?? 0) > 0).length;
  const exactHits = ordered.filter((p) => (p.points ?? 0) >= 3).length;

  let streak = 0;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    if ((ordered[i].points ?? 0) > 0) streak += 1;
    else break;
  }
  let longestStreak = 0;
  let run = 0;
  for (const p of ordered) {
    if ((p.points ?? 0) > 0) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else run = 0;
  }

  const methodStats = new Map<Method, Tally>();
  const segmentStats = new Map<string, Tally>();
  const favoriteStats: Tally = { total: 0, hits: 0 };
  const underdogStats: Tally = { total: 0, hits: 0 };
  let mainEventStreak = 0;
  let mainEventRun = 0;
  let boldHits = 0;
  let boldUnderdogHits = 0;
  let soloHits = 0;
  let topSolo: SeasonStats["topSolo"] = null;

  for (const p of ordered) {
    const meta = fightMeta.get(p.fight_id)!;
    const won = (p.points ?? 0) > 0;

    const method = p.predicted_method as Method;
    const methodEntry = methodStats.get(method) ?? { total: 0, hits: 0 };
    methodEntry.total += 1;
    if (won) methodEntry.hits += 1;
    methodStats.set(method, methodEntry);

    if (meta.cardSegment) {
      const key = meta.cardSegment === "main_card" ? "Hlavní karta" : "Prelims";
      const segmentEntry = segmentStats.get(key) ?? { total: 0, hits: 0 };
      segmentEntry.total += 1;
      if (won) segmentEntry.hits += 1;
      segmentStats.set(key, segmentEntry);
    }

    // Favourite vs. underdog goes by the odds captured when the fight was
    // graded. A tie isn't classified either way.
    const pickedA = p.predicted_winner_id === meta.fighterAId;
    if (meta.oddsA != null && meta.oddsB != null && meta.oddsA !== meta.oddsB) {
      const pickedOdds = pickedA ? meta.oddsA : meta.oddsB;
      const otherOdds = pickedA ? meta.oddsB : meta.oddsA;
      const bucket = pickedOdds < otherOdds ? favoriteStats : underdogStats;
      bucket.total += 1;
      if (won) bucket.hits += 1;
      if (won && boldFightIds.has(p.fight_id) && pickedOdds > otherOdds) boldUnderdogHits += 1;
    }

    if (meta.isMainEvent) {
      if (won) {
        mainEventRun += 1;
        mainEventStreak = Math.max(mainEventStreak, mainEventRun);
      } else mainEventRun = 0;
    }

    if (won && boldFightIds.has(p.fight_id)) boldHits += 1;

    const counts = pickCounts.get(p.fight_id);
    if (won && counts && counts.total >= 3) {
      const share = (counts.byFighter.get(p.predicted_winner_id) ?? 0) / counts.total;
      if (share <= 1 / 3) soloHits += 1;
      if (!topSolo || share < topSolo.share) {
        topSolo = {
          // filled in below once we know the fighter's name
          fighterName: p.predicted_winner_id,
          share,
          eventLabel: eventById.get(meta.eventId)?.label ?? "",
        };
      }
    }
  }

  if (topSolo) {
    const { data: fighter } = await supabase
      .from("fighters")
      .select("name")
      .eq("id", topSolo.fighterName)
      .maybeSingle();
    topSolo = { ...topSolo, fighterName: fighter?.name ?? "?" };
  }

  // ---- when do you tip? --------------------------------------------------
  // How long before lock the tipper first touched each gala. The median, not
  // the mean: one gala tipped a month early would otherwise hide a habit of
  // filing everything in the last hour.
  const leadTimes: number[] = [];
  let lastMinuteEvents = 0;
  for (const row of allRows ?? []) {
    if (row.user_id !== userId || !row.earliest_prediction_at) continue;
    const lockAt = lockAtById.get(row.event_id);
    if (!lockAt) continue;
    const minutes = Math.round(
      (new Date(lockAt).getTime() - new Date(row.earliest_prediction_at).getTime()) / 60000
    );
    if (minutes < 0) continue;
    leadTimes.push(minutes);
    if (minutes <= 60) lastMinuteEvents += 1;
  }

  // ---- kecárna -----------------------------------------------------------
  const emojiCounts = new Map<string, number>();
  let topReacted: { body: string; count: number } | null = null;
  let gifs = 0;
  for (const comment of myComments ?? []) {
    const reactions = (comment.event_comment_reactions ?? []) as { emoji: string }[];
    for (const reaction of reactions) {
      emojiCounts.set(reaction.emoji, (emojiCounts.get(reaction.emoji) ?? 0) + 1);
    }
    if (comment.gif_url) gifs += 1;
    if (comment.body && reactions.length > (topReacted?.count ?? 0)) {
      topReacted = { body: comment.body, count: reactions.length };
    }
  }
  const topEmoji =
    [...emojiCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const played = [...nights];
  const best = played.length
    ? played.reduce((top, n) => (n.points > top.points ? n : top))
    : null;
  const worst =
    played.length > 1 ? played.reduce((low, n) => (n.points < low.points ? n : low)) : null;

  return {
    season,
    events,
    nights: played,
    totalPoints,
    seasonRank: seasonIndex >= 0 ? seasonIndex + 1 : null,
    seasonTotal: seasonRows?.length ?? null,
    eventWins,
    perfectCards: played.filter((n) => n.perfectCard).length,

    totalGraded,
    hits,
    accuracy: totalGraded > 0 ? Math.round((hits / totalGraded) * 100) : 0,
    exactHits,
    streak,
    longestStreak,
    mainEventStreak,

    methodStats,
    segmentStats,
    favoriteStats,
    underdogStats,
    oddsClassified: favoriteStats.total + underdogStats.total,
    underdogShare:
      favoriteStats.total + underdogStats.total > 0
        ? underdogStats.total / (favoriteStats.total + underdogStats.total)
        : 0,

    boldTotal: boldFightIds.size,
    boldHits,
    boldUnderdogHits,
    soloHits,
    topSolo,

    fotnTotal: (myBonus ?? []).length,
    fotnHits: (myBonus ?? []).filter((b) => (b.points ?? 0) > 0).length,

    best,
    worst: worst && best && worst.event.id === best.event.id ? null : worst,

    medianMinutesBeforeLock: median(leadTimes),
    lastMinuteEvents,

    comments: {
      count: (myComments ?? []).length,
      topEmoji,
      topReacted: topReacted && topReacted.count > 0 ? topReacted : null,
      gifs,
    },

    nemesis,
    balance: playedForMoney ? balance : null,
  };
}

export type Badge = { key: string; label: string };

/** The season's badges, derived from the stats above - shared by the tipper
 * detail page and Wrapped so nobody earns a badge on one screen and not the
 * other. */
export function seasonBadges(stats: SeasonStats): Badge[] {
  const badges: Badge[] = [];
  if (stats.eventWins > 0) {
    badges.push({
      key: "king",
      label: stats.eventWins > 1 ? `Král večera ×${stats.eventWins}` : "Král večera",
    });
  }
  if (stats.perfectCards > 0) {
    badges.push({
      key: "perfect",
      label: stats.perfectCards > 1 ? `Perfektní karta ×${stats.perfectCards}` : "Perfektní karta",
    });
  }
  if (stats.streak >= 3) {
    badges.push({ key: "streak", label: `Na vlně (${stats.streak} v řadě)` });
  }
  if (stats.totalGraded >= 5 && stats.accuracy >= 70) {
    badges.push({ key: "sharp", label: "Ostrostřelec" });
  }
  if (stats.exactHits >= 3) {
    badges.push({ key: "sniper", label: `Sniper (přesný tip ×${stats.exactHits})` });
  }
  if (stats.events.length >= 3 && stats.nights.length === stats.events.length) {
    badges.push({ key: "loyal", label: "Věrný fanda" });
  }
  if (stats.oddsClassified >= 5 && stats.underdogShare >= 0.3) {
    badges.push({ key: "brave", label: "Odvážlivec" });
  }
  if (stats.boldUnderdogHits > 0) {
    badges.push({
      key: "bold-underdog",
      label:
        stats.boldUnderdogHits > 1
          ? `Odvážlivec večera ×${stats.boldUnderdogHits}`
          : "Odvážlivec večera",
    });
  }
  if (stats.mainEventStreak >= 3) {
    badges.push({ key: "main-event", label: `Pán hlavního zápasu (${stats.mainEventStreak} v řadě)` });
  }
  if (stats.soloHits >= 3) {
    badges.push({ key: "solo", label: `Solitér (proti davu ×${stats.soloHits})` });
  }
  return badges;
}
