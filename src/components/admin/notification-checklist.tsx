import { Check, Clock, AlertTriangle, Minus, Info, Megaphone } from "lucide-react";
import { pragueDaysBeforeIso } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Every push one gala can generate, in the order it happens. Each entry
 * mirrors a `send_*` function in scraper/cron.py (or import_results.py) and the
 * column it stamps when it fires - if you add a broadcast there, add it here
 * too, or the checklist quietly under-reports.
 *
 * Three of them have no sent-marker in the database at all, so they're shown as
 * "nesleduje se" rather than faked into a green tick. */
type Row = {
  key: string;
  label: string;
  /** who gets it and when */
  detail: string;
  sentAt?: string | null;
  /** when it's expected to fire, if that's computable up front */
  dueAt?: string | null;
  /** already happened, but there's no timestamp to show */
  done?: boolean;
  /** greyed out with a reason instead of "waiting" */
  notApplicable?: string;
  /** nothing is persisted - say so instead of guessing */
  untracked?: string;
  /** replaces the computed status line (progress counters etc.) */
  note?: string;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  });
}

function StatusRow({ row }: { row: Row }) {
  const sent = Boolean(row.sentAt) || row.done === true;
  const overdue =
    !sent && !row.notApplicable && !row.untracked && row.dueAt != null && new Date(row.dueAt) < new Date();

  const state = sent
    ? {
        icon: <Check className="size-3.5" />,
        tone: "bg-green-600/15 text-green-700 dark:text-green-400",
        text: "text-green-700 dark:text-green-400",
        note: row.sentAt ? `Odesláno ${fmt(row.sentAt)}` : "Odesláno",
      }
    : row.notApplicable
      ? {
          icon: <Minus className="size-3.5" />,
          tone: "bg-neutral-500/10 text-neutral-500 dark:text-neutral-400",
          text: "text-neutral-500 dark:text-neutral-400",
          note: row.notApplicable,
        }
      : row.untracked
        ? {
            icon: <Info className="size-3.5" />,
            tone: "bg-neutral-500/10 text-neutral-500 dark:text-neutral-400",
            text: "text-neutral-500 dark:text-neutral-400",
            note: row.untracked,
          }
        : overdue
          ? {
              icon: <AlertTriangle className="size-3.5" />,
              tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
              text: "text-amber-700 dark:text-amber-400",
              // the cron ticks every few minutes, so "past due and still
              // unsent" means something is stuck - worth flagging, not hiding
              note: `Mělo odejít ${fmt(row.dueAt!)} — mrkni na log scraperu`,
            }
          : {
              icon: <Clock className="size-3.5" />,
              tone: "bg-neutral-500/10 text-neutral-500 dark:text-neutral-400",
              text: "text-neutral-500 dark:text-neutral-400",
              note: row.dueAt ? `Čeká · plánováno ${fmt(row.dueAt)}` : "Čeká",
            };

  return (
    <li className="flex items-start gap-2.5">
      <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full", state.tone)}>
        {state.icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium">{row.label}</span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{row.detail}</span>
        <span className={cn("text-xs", row.note ? "text-neutral-500 dark:text-neutral-400" : state.text)}>
          {row.note ?? state.note}
        </span>
      </span>
    </li>
  );
}

function List({ rows }: { rows: Row[] }) {
  return (
    <ul className="flex flex-col gap-3 rounded-xl border border-white/45 bg-white/35 p-3 shadow-lg shadow-black/20 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      {rows.map((row) => (
        <StatusRow key={row.key} row={row} />
      ))}
    </ul>
  );
}

export function NotificationChecklist({
  eventDate,
  lockAt,
  status,
  payoutsEnabled,
  hypeNotifiedAt,
  cardNotifiedAt,
  cardCheckedAt,
  reminderSentAt,
  lockNotifiedAt,
  followupNotifiedAt,
  fotnReminderSentAt,
  payoutAllPaidNotifiedAt,
  gradedFights,
  countableFights,
}: {
  eventDate: string;
  lockAt: string | null;
  status: string;
  payoutsEnabled: boolean;
  hypeNotifiedAt: string | null;
  cardNotifiedAt: string | null;
  cardCheckedAt: string | null;
  reminderSentAt: string | null;
  lockNotifiedAt: string | null;
  followupNotifiedAt: string | null;
  fotnReminderSentAt: string | null;
  payoutAllPaidNotifiedAt: string | null;
  gradedFights: number;
  countableFights: number;
}) {
  const completed = status === "completed";

  // Mirrors cron.py: HYPE_DAYS_BEFORE=6 at 14:00, PUBLISH_DAYS_BEFORE=3 at
  // 9:00, FOLLOWUP_DAYS_AFTER=1 at 14:00 - all Prague wall-clock.
  const hypeAt = pragueDaysBeforeIso(eventDate, 6, 14);
  const cardAt = pragueDaysBeforeIso(eventDate, 3, 9);
  const followupAt = pragueDaysBeforeIso(eventDate, -1, 14);

  const broadcasts: Row[] = [
    {
      key: "hype",
      label: "Upoutávka na YouTube",
      detail: "Všem · 6 dní předem ve 14:00, odkaz na kanál OKTAGONu",
      sentAt: hypeNotifiedAt,
      dueAt: hypeAt,
    },
    {
      key: "card",
      label: "Karta je online",
      detail: "Všem · jakmile se naimportují zápasy zveřejněného galavečera",
      sentAt: cardNotifiedAt,
      dueAt: status === "draft" ? cardAt : null,
    },
    {
      key: "recheck",
      label: "Karta se změnila",
      detail: "Všem · při kontrole karty (každé 3 h), když přibyl nebo odpadl zápas",
      untracked: cardCheckedAt
        ? `Nesleduje se — může odejít víckrát. Poslední kontrola ${fmt(cardCheckedAt)}`
        : "Nesleduje se — může odejít víckrát",
    },
    {
      key: "reminder",
      label: "Připomínka před uzávěrkou",
      detail: "Všem · hodinu před zámkem, každému s vlastním počtem „X z Y“",
      sentAt: reminderSentAt,
      dueAt: lockAt ? new Date(new Date(lockAt).getTime() - 60 * 60 * 1000).toISOString() : null,
    },
    {
      key: "lock",
      label: "Tipy uzavřeny",
      detail: "Všem · v okamžiku uzávěrky, odkaz na žebříček",
      sentAt: lockNotifiedAt,
      dueAt: lockAt,
    },
    {
      key: "results",
      label: "Výsledky zápasů",
      detail: "Tipérům na daný zápas · průběžně, jak se zápasy bodují",
      done: countableFights > 0 && gradedFights >= countableFights,
      note:
        countableFights === 0
          ? "Karta ještě není"
          : `Odbodováno ${gradedFights} z ${countableFights} zápasů`,
    },
    {
      key: "results-done",
      label: "Výsledky jsou hotové",
      detail: "Všem · když se galavečer uzavře (u startovného i s QR platbou)",
      done: completed,
      // no column for this one; "completed" is the same condition the cron uses
      note: completed ? "Odesláno při uzavření galavečera" : "Čeká na uzavření galavečera",
    },
    {
      key: "followup",
      label: "Ohlédnutí za galavečerem",
      detail: "Všem · den po galavečeru ve 14:00, plus pozvánka na další",
      sentAt: followupNotifiedAt,
      dueAt: followupAt,
    },
  ];

  const personal: Row[] = [
    {
      key: "fotn",
      label: "Chybí Fight of the Night",
      detail: "Jen adminům · když jsou všechny zápasy odbodované a FOTN chybí",
      sentAt: fotnReminderSentAt,
    },
    {
      key: "payout-win",
      label: "Vyhrál jsi startovné",
      detail: "Jen vítězi · při uzavření, pokud nemá vyplněné číslo účtu",
      notApplicable: payoutsEnabled ? undefined : "Galavečer je bez startovného",
      untracked: payoutsEnabled ? "Nesleduje se" : undefined,
    },
    {
      key: "payout-settled",
      label: "Startovné vyplaceno",
      detail: "Jen vítězi · jakmile se všichni odškrtnou jako zaplacení",
      sentAt: payoutAllPaidNotifiedAt,
      notApplicable: payoutsEnabled ? undefined : "Galavečer je bez startovného",
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Megaphone className="size-4 text-yellow-600 dark:text-accent" />
        Notifikace
      </h2>

      <List rows={broadcasts} />

      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Nehromadné
      </p>
      <List rows={personal} />

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Zprávy z kecárny chodí zvlášť — cron je jednou za tik sloučí do jedné notifikace na galavečer,
        takže se tady nepočítají. Jednorázový vlastní text pošleš přes „Poslat upozornění“ v přehledu
        adminu; ten se nikam neukládá.
      </p>
    </section>
  );
}
