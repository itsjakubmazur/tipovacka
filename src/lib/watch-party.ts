/** Sledovačka - koukání na galavečer společně v garáži.
 *
 * Je vždycky ve stejné garáži, takže místo není pole ve formuláři, ale
 * konstanta: nedá se omylem přepsat a nikdo ho nemusí pokaždé vyplňovat. */
export const WATCH_PARTY_PLACE = "Garáž u Rejdoše";

/** Strop hostů na jednoho člověka - musí sedět s DB checkem
 * (`plus_ones between 0 and 5`), jinak by UI nabídlo krok, který skončí chybou. */
export const MAX_PLUS_ONES = 5;

export type WatchPartyAnswer = "yes" | "maybe" | "no";

export type WatchPartyRow = {
  userId: string;
  nickname: string;
  answer: WatchPartyAnswer;
  plusOnes: number;
};

export type WatchPartyMine = { answer: WatchPartyAnswer; plusOnes: number };

/** Čtyři tlačítka v kartě jsou tři odpovědi plus počet hostů. */
export type WatchPartyChoice = "alone" | "plus" | "maybe" | "no";

export function choiceOf(mine: WatchPartyMine | null): WatchPartyChoice | null {
  if (!mine) return null;
  if (mine.answer === "yes") return mine.plusOnes > 0 ? "plus" : "alone";
  return mine.answer;
}

/** Co se uloží po klepnutí na segment. „S někým“ začíná na jednom hostovi;
 * kdo už nějaké má, o ně přepnutím sem a zpátky nepřijde. */
export function answerFor(choice: WatchPartyChoice, currentPlusOnes: number): WatchPartyMine {
  switch (choice) {
    case "alone":
      return { answer: "yes", plusOnes: 0 };
    case "plus":
      return { answer: "yes", plusOnes: Math.min(Math.max(currentPlusOnes, 1), MAX_PLUS_ONES) };
    default:
      return { answer: choice, plusOnes: 0 };
  }
}

export type WatchPartySummary = {
  /** kolik lidí bude v garáži: každé „dorazím“ je člověk plus jeho hosti */
  headcount: number;
  yes: WatchPartyRow[];
  maybe: WatchPartyRow[];
  no: WatchPartyRow[];
  /** hosti mimo appku, dohromady */
  guests: number;
};

export function summarize(rows: WatchPartyRow[]): WatchPartySummary {
  const yes = rows.filter((r) => r.answer === "yes");
  const guests = yes.reduce((n, r) => n + r.plusOnes, 0);
  return {
    yes,
    maybe: rows.filter((r) => r.answer === "maybe"),
    no: rows.filter((r) => r.answer === "no"),
    guests,
    headcount: yes.length + guests,
  };
}

/** Hlavní řádek nad tlačítky. „Bude nás 9“ nefunguje pro jednoho člověka -
 * sám sobě nejsi „nás“ - a po galavečeru už je z toho vzpomínka, ne pozvánka. */
export function headline(
  summary: WatchPartySummary,
  currentUserId: string,
  completed: boolean
): string {
  const { headcount, yes } = summary;

  if (completed) {
    if (headcount === 0) return "Do garáže nakonec nikdo nedorazil.";
    if (headcount === 1) {
      const only = yes[0];
      return only.userId === currentUserId
        ? "V garáži jsi byl jenom ty."
        : `V garáži byl jenom ${only.nickname}.`;
    }
    return `V garáži nás bylo ${headcount}.`;
  }

  if (headcount === 0) return "Zatím se nikdo nepřihlásil.";
  if (headcount === 1) {
    const only = yes[0];
    return only.userId === currentUserId ? "Zatím jdeš jenom ty." : `Zatím dorazí jenom ${only.nickname}.`;
  }
  return `Bude nás ${headcount}.`;
}

/** Rozpad pod hlavním řádkem: „7 dorazí (+2) · 2 možná · 1 ne“. Prázdné
 * skupiny se vynechávají, ať tam nesvítí samé nuly. */
export function detailLine(summary: WatchPartySummary): string | null {
  const parts: string[] = [];
  if (summary.yes.length > 0) {
    parts.push(`${summary.yes.length} dorazí${summary.guests > 0 ? ` (+${summary.guests})` : ""}`);
  }
  if (summary.maybe.length > 0) parts.push(`${summary.maybe.length} možná`);
  if (summary.no.length > 0) parts.push(`${summary.no.length} ne`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Jména ve skupině, s hosty připsanými k tomu, kdo je veze („Rejdoš +2“). */
export function namesOf(rows: WatchPartyRow[]): string {
  return rows.map((r) => (r.plusOnes > 0 ? `${r.nickname} +${r.plusOnes}` : r.nickname)).join(", ");
}
