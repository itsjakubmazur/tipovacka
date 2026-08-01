/** The season-long ladder: Amatér → Prospect → Kontender → Vyzyvatel → Šampion.
 *
 * Badges are a collection - you either have one or you don't, and they say
 * nothing about where the season is going. This is the spine: one number, one
 * position, and always a stated distance to the next rung, so there's a reason
 * to open the app between galas.
 *
 * The thresholds assume roughly 20 points a gala for a decent tipper (the
 * observed range is ~12-25) over a season of ten or so galas. They're the one
 * thing here worth re-tuning once a full season's worth of real numbers
 * exists - everything else derives from them. */
export type Tier = {
  name: string;
  /** season points needed to hold this title */
  from: number;
};

export const TIERS: Tier[] = [
  { name: "Amatér", from: 0 },
  { name: "Prospect", from: 30 },
  { name: "Kontender", from: 75 },
  { name: "Vyzyvatel", from: 140 },
  { name: "Šampion", from: 220 },
];

export type PathProgress = {
  tier: Tier;
  tierIndex: number;
  next: Tier | null;
  /** points still needed for the next title, 0 once you're at the top */
  toNext: number;
  /** 0-1 within the current rung, for the progress rail */
  fraction: number;
};

export function tipperPath(points: number): PathProgress {
  // last tier whose threshold we've passed
  let tierIndex = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (points >= TIERS[i].from) tierIndex = i;
  }

  const tier = TIERS[tierIndex];
  const next = TIERS[tierIndex + 1] ?? null;

  if (!next) return { tier, tierIndex, next: null, toNext: 0, fraction: 1 };

  const span = next.from - tier.from;
  return {
    tier,
    tierIndex,
    next,
    toNext: Math.max(0, next.from - points),
    fraction: span > 0 ? Math.min(1, Math.max(0, (points - tier.from) / span)) : 1,
  };
}
