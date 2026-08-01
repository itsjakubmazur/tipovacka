import type { Badge, SeasonStats } from "@/lib/season-stats";
import type { Archetype } from "@/lib/tipper-archetype";
import { METHOD_LABELS } from "@/lib/method-labels";
import type { Method } from "@/lib/types";

export type Scene =
  | {
      kind: "intro";
      season: number;
      nickname: string;
      galas: number;
      posters: string[];
    }
  | {
      kind: "stat";
      eyebrow: string;
      value: string;
      unit?: string;
      label: string;
      sub?: string;
    }
  | { kind: "ring"; eyebrow: string; percent: number; label: string; sub?: string }
  | {
      kind: "night";
      eyebrow: string;
      poster: string | null;
      title: string;
      subtitle: string | null;
      points: number;
      rank: number | null;
      participants: number;
      tone: "best" | "worst";
    }
  | {
      kind: "bars";
      eyebrow: string;
      title: string;
      rows: { label: string; value: number; caption: string }[];
      sub?: string;
    }
  | { kind: "archetype"; archetype: Archetype; nickname: string }
  | { kind: "solo"; fighterName: string; share: number; eventLabel: string }
  | { kind: "nemesis"; nickname: string; wins: number; losses: number }
  | {
      kind: "chat";
      count: number;
      gifs: number;
      topEmoji: string | null;
      topReacted: { body: string; count: number } | null;
    }
  | { kind: "badges"; badges: Badge[] }
  | {
      kind: "finale";
      season: number;
      nickname: string;
      points: number;
      rank: number | null;
      total: number | null;
      archetypeName: string;
      shareUrl: string;
      shareText: string;
    };

export function pluralCz(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

function czechLeadTime(minutes: number): string {
  if (minutes < 90) return `${minutes} minut`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} ${pluralCz(hours, "hodinu", "hodiny", "hodin")}`;
  const days = Math.round(hours / 24);
  return `${days} ${pluralCz(days, "den", "dny", "dnů")}`;
}

/** Turns a season into the sequence you swipe through. Scenes with nothing to
 * say drop out rather than showing a zero - a recap that admits it has no
 * material is worse than a shorter one. */
export function buildScenes(
  stats: SeasonStats,
  archetype: Archetype,
  nickname: string,
  badges: Badge[],
  shareUrl: string
): Scene[] {
  const scenes: Scene[] = [];
  const posters = stats.nights
    .map((night) => night.event.imageUrl)
    .filter((url): url is string => Boolean(url));

  scenes.push({
    kind: "intro",
    season: stats.season,
    nickname,
    galas: stats.nights.length,
    posters,
  });

  const tippedFights = stats.nights.reduce((sum, night) => sum + night.fightsScored, 0);
  scenes.push({
    kind: "stat",
    eyebrow: "Kolik toho bylo",
    value: String(stats.nights.length),
    unit: pluralCz(stats.nights.length, "galavečer", "galavečery", "galavečerů"),
    label: `${tippedFights} ${pluralCz(tippedFights, "natipovaný zápas", "natipované zápasy", "natipovaných zápasů")}`,
    sub:
      stats.nights.length < stats.events.length
        ? `Ze ${stats.events.length} ${pluralCz(stats.events.length, "gala", "gal", "gal")} sezóny`
        : "Ani jeden jsi nevynechal",
  });

  scenes.push({
    kind: "stat",
    eyebrow: "Celkem",
    value: String(stats.totalPoints),
    unit: pluralCz(stats.totalPoints, "bod", "body", "bodů"),
    label:
      stats.seasonRank && stats.seasonTotal
        ? `${stats.seasonRank}. místo z ${stats.seasonTotal}`
        : "v sezóně",
    sub: stats.eventWins > 0 ? `${stats.eventWins}× král večera` : undefined,
  });

  if (stats.totalGraded > 0) {
    scenes.push({
      kind: "ring",
      eyebrow: "Trefa",
      percent: stats.accuracy,
      label: `${stats.hits} z ${stats.totalGraded} zápasů`,
      sub:
        stats.exactHits > 0
          ? `${stats.exactHits}× přesně - vítěz, způsob i kolo`
          : undefined,
    });
  }

  if (stats.longestStreak >= 3) {
    scenes.push({
      kind: "stat",
      eyebrow: "Nejdelší série",
      value: String(stats.longestStreak),
      unit: "v řadě",
      label: "trefených zápasů za sebou",
      sub: stats.streak >= 3 ? `A právě teď jich máš ${stats.streak}` : undefined,
    });
  }

  if (stats.best) {
    scenes.push({
      kind: "night",
      eyebrow: "Tvůj večer",
      poster: stats.best.event.imageUrl,
      title: stats.best.event.label,
      subtitle: stats.best.event.subtitle,
      points: stats.best.points,
      rank: stats.best.rank,
      participants: stats.best.participants,
      tone: "best",
    });
  }

  if (stats.worst) {
    scenes.push({
      kind: "night",
      eyebrow: "A tenhle radši zapomeň",
      poster: stats.worst.event.imageUrl,
      title: stats.worst.event.label,
      subtitle: stats.worst.event.subtitle,
      points: stats.worst.points,
      rank: stats.worst.rank,
      participants: stats.worst.participants,
      tone: "worst",
    });
  }

  const methodRows = (["KO/TKO", "SUBMISSION", "DECISION"] as Method[])
    .map((method) => {
      const tally = stats.methodStats.get(method);
      return tally && tally.total > 0
        ? {
            label: METHOD_LABELS[method],
            value: tally.total,
            caption: `${tally.hits}/${tally.total} trefa`,
          }
        : null;
    })
    .filter((row): row is { label: string; value: number; caption: string } => row !== null);
  if (methodRows.length > 1) {
    const top = methodRows.reduce((best, row) => (row.value > best.value ? row : best));
    scenes.push({
      kind: "bars",
      eyebrow: "Tvůj rukopis",
      title: `Sázíš na ${top.label.toLowerCase()}`,
      rows: methodRows,
      sub: "Podle toho, jak často jsi na daný způsob ukončení tipoval",
    });
  }

  if (stats.oddsClassified >= 5) {
    scenes.push({
      kind: "bars",
      eyebrow: "Favorit, nebo outsider",
      title:
        stats.underdogShare >= 0.35
          ? "Kurzy tě moc nezajímají"
          : "Držíš se toho, co říkají sázkovky",
      rows: [
        {
          label: "Favorité",
          value: stats.favoriteStats.total,
          caption: `${stats.favoriteStats.hits}/${stats.favoriteStats.total} trefa`,
        },
        {
          label: "Outsideři",
          value: stats.underdogStats.total,
          caption: `${stats.underdogStats.hits}/${stats.underdogStats.total} trefa`,
        },
      ],
      sub: `${Math.round(stats.underdogShare * 100)} % tvých tipů šlo proti kurzu`,
    });
  }

  if (stats.medianMinutesBeforeLock != null) {
    const lead = stats.medianMinutesBeforeLock;
    scenes.push({
      kind: "stat",
      eyebrow: "Kdy tipuješ",
      value: czechLeadTime(lead).split(" ")[0],
      unit: czechLeadTime(lead).split(" ").slice(1).join(" ") || "min",
      label: "před zamčením, typicky",
      sub:
        stats.lastMinuteEvents > 0
          ? `${stats.lastMinuteEvents}× jsi to stihl v poslední hodině`
          : "Klidná ruka, žádný stres",
    });
  }

  if (stats.boldTotal > 0) {
    scenes.push({
      kind: "stat",
      eyebrow: "Jistotka",
      value: `${stats.boldHits}/${stats.boldTotal}`,
      label: "dvojnásobných sázek vyšlo",
      sub:
        stats.boldUnderdogHits > 0
          ? `${stats.boldUnderdogHits}× dokonce na outsidera`
          : undefined,
    });
  }

  if (stats.fotnTotal > 0) {
    scenes.push({
      kind: "stat",
      eyebrow: "Zápas večera",
      value: `${stats.fotnHits}/${stats.fotnTotal}`,
      label: "trefených bonusů",
      sub: stats.fotnHits > 0 ? `${stats.fotnHits * 2} bodů navíc` : "Příště to vyjde",
    });
  }

  if (stats.topSolo && stats.topSolo.share <= 0.5) {
    scenes.push({
      kind: "solo",
      fighterName: stats.topSolo.fighterName,
      share: stats.topSolo.share,
      eventLabel: stats.topSolo.eventLabel,
    });
  }

  scenes.push({ kind: "archetype", archetype, nickname });

  if (stats.nemesis) {
    scenes.push({
      kind: "nemesis",
      nickname: stats.nemesis.nickname,
      wins: stats.nemesis.wins,
      losses: stats.nemesis.losses,
    });
  }

  if (stats.comments.count > 0) {
    scenes.push({
      kind: "chat",
      count: stats.comments.count,
      gifs: stats.comments.gifs,
      topEmoji: stats.comments.topEmoji,
      topReacted: stats.comments.topReacted,
    });
  }

  if (badges.length > 0) {
    scenes.push({ kind: "badges", badges });
  }

  scenes.push({
    kind: "finale",
    season: stats.season,
    nickname,
    points: stats.totalPoints,
    rank: stats.seasonRank,
    total: stats.seasonTotal,
    archetypeName: archetype.name,
    shareUrl,
    shareText: `${nickname}: sezóna ${stats.season} v tipovačce — ${stats.totalPoints} ${pluralCz(
      stats.totalPoints,
      "bod",
      "body",
      "bodů"
    )}${stats.seasonRank ? `, ${stats.seasonRank}. místo` : ""} · ${archetype.name}`,
  });

  return scenes;
}
