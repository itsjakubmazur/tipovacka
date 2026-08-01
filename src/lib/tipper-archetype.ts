import type { SeasonStats } from "@/lib/season-stats";

/** The four axes a tipper's season is scored on. Each is a letter pair; the
 * four letters together name an archetype.
 *
 * This is the piece that makes a recap worth posting into the group chat -
 * "kolik jsem měl bodů" is a number, "jsem Kamikadze" is an identity. The
 * axes are deliberately the ones we can measure honestly from picks, not
 * personality guesses. */
export type Axis = {
  key: "odds" | "finish" | "timing" | "crowd";
  /** left-hand pole (letter, label) */
  low: { letter: string; label: string };
  /** right-hand pole */
  high: { letter: string; label: string };
  /** 0 = fully the low pole, 1 = fully the high pole */
  value: number;
  /** which pole won */
  letter: string;
  label: string;
  /** one line of evidence, shown under the bar */
  evidence: string;
};

export type Archetype = {
  code: string;
  name: string;
  tagline: string;
  axes: Axis[];
  /** too little graded data to say this with a straight face */
  provisional: boolean;
};

const NAMES: Record<string, { name: string; tagline: string }> = {
  FKPS: { name: "Chirurg", tagline: "Plán, jistá ruka a vlastní hlava." },
  FKPC: { name: "Učebnice", tagline: "Přesně to, co říkají kurzy - a většinou to vyjde." },
  FKDS: { name: "Půlnoční exekutor", tagline: "Tipuješ pozdě, tvrdě a po svém." },
  FKDC: { name: "Rychlá ruka", tagline: "Na poslední chvíli, na favorita, na ukončení." },
  FBPS: { name: "Účetní", tagline: "Body se počítají do posledního kola. A ty je počítáš sám." },
  FBPC: { name: "Statistik", tagline: "Favorit, plná tříbodovka, žádná dobrodružství." },
  FBDS: { name: "Opatrný rebel", tagline: "Riskuješ jen tehdy, když víš proč." },
  FBDC: { name: "Konzerva", tagline: "Nudné? Možná. Funkční? Podezřele často." },
  OKPS: { name: "Prorok", tagline: "Viděl jsi to dřív než ostatní. A dřív než sázkovky." },
  OKPC: { name: "Snílek", tagline: "Věříš na zázraky - a občas jeden trefíš." },
  OKDS: { name: "Kamikadze", tagline: "Minutu před zamčením vsadíš na outsidera KO." },
  OKDC: { name: "Zapalovač", tagline: "Nudný večer si nepřipouštíš." },
  OBPS: { name: "Šachista", tagline: "Dlouhá hra, tichý tah, nikdo neví proč." },
  OBPC: { name: "Trpělivý outsider", tagline: "Věříš na underdogy, kteří to uchodí do konce." },
  OBDS: { name: "Noční filozof", tagline: "Tipuješ pozdě, proti všem a na rozhodnutí." },
  OBDC: { name: "Loterie", tagline: "Někdy to vyjde. A to je celé kouzlo." },
};

function czechHours(minutes: number): string {
  if (minutes < 90) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "1 den";
  if (days >= 2 && days <= 4) return `${days} dny`;
  return `${days} dnů`;
}

export function tipperArchetype(stats: SeasonStats): Archetype {
  // 1. Kurz. Underdog share above a third of classified picks reads as
  // genuinely contrarian betting, not noise.
  const oddsValue = stats.oddsClassified > 0 ? Math.min(1, stats.underdogShare / 0.5) : 0.5;

  // 2. Ukončení. What share of picks call a finish rather than the cards.
  const methodTotal = [...stats.methodStats.values()].reduce((sum, t) => sum + t.total, 0);
  const finishes =
    (stats.methodStats.get("KO/TKO")?.total ?? 0) + (stats.methodStats.get("SUBMISSION")?.total ?? 0);
  const finishShare = methodTotal > 0 ? finishes / methodTotal : 0.5;

  // 3. Načasování. Median lead time, squashed onto a day: everything filed
  // more than 24 h ahead is equally "early".
  const lead = stats.medianMinutesBeforeLock;
  const timingValue = lead == null ? 0.5 : 1 - Math.min(1, lead / (24 * 60));

  // 4. Dav. How much of your correct calls came from going against the room.
  const crowdValue = stats.hits > 0 ? Math.min(1, stats.soloHits / Math.max(1, stats.hits * 0.35)) : 0.5;

  const axes: Axis[] = [
    {
      key: "odds",
      low: { letter: "F", label: "Favorit" },
      high: { letter: "O", label: "Outsider" },
      value: oddsValue,
      letter: oddsValue >= 0.5 ? "O" : "F",
      label: oddsValue >= 0.5 ? "Outsider" : "Favorit",
      evidence:
        stats.oddsClassified > 0
          ? `${Math.round(stats.underdogShare * 100)} % tipů proti kurzu`
          : "málo kurzů k porovnání",
    },
    {
      key: "finish",
      low: { letter: "B", label: "Bodař" },
      high: { letter: "K", label: "Finišer" },
      value: finishShare,
      letter: finishShare >= 0.5 ? "K" : "B",
      label: finishShare >= 0.5 ? "Finišer" : "Bodař",
      evidence:
        methodTotal > 0
          ? `${Math.round(finishShare * 100)} % tipů na ukončení`
          : "zatím bez vyhodnocených tipů",
    },
    {
      key: "timing",
      low: { letter: "P", label: "Předem" },
      high: { letter: "D", label: "Deadliner" },
      value: timingValue,
      letter: timingValue >= 0.5 ? "D" : "P",
      label: timingValue >= 0.5 ? "Deadliner" : "Předem",
      evidence: lead == null ? "bez dat o načasování" : `typicky ${czechHours(lead)} před zamčením`,
    },
    {
      key: "crowd",
      low: { letter: "C", label: "S davem" },
      high: { letter: "S", label: "Solitér" },
      value: crowdValue,
      letter: crowdValue >= 0.5 ? "S" : "C",
      label: crowdValue >= 0.5 ? "Solitér" : "S davem",
      evidence:
        stats.hits > 0
          ? `${stats.soloHits}× trefa proti většině`
          : "zatím bez trefených tipů",
    },
  ];

  const code = axes[0].letter + axes[1].letter + axes[2].letter + axes[3].letter;
  const named = NAMES[code] ?? { name: "Tipér", tagline: "Sezóna teprve začíná." };

  return {
    code,
    name: named.name,
    tagline: named.tagline,
    axes,
    provisional: stats.totalGraded < 15,
  };
}
