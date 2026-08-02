import { Check, Clock, AlertTriangle, Minus, Megaphone } from "lucide-react";
import { Disclosure } from "@/components/ui/disclosure";
import { Section } from "@/components/ui/section-heading";
import { pragueDaysBeforeIso } from "@/lib/time";
import { cn } from "@/lib/utils";

/** One line in the push log: a whole campaign, not one device. */
export type PushLogEntry = {
  kind: string;
  title: string;
  recipients: number;
  sent_at: string;
};

/** Every push one gala can generate, in the order it happens. Each entry
 * mirrors a `send_*` function in scraper/cron.py (or import_results.py).
 *
 * Two sources of truth, deliberately: the `events.*_notified_at` columns the
 * cron already stamped (they cover galas from before the push log existed) and
 * `push_log`, which records every send including the repeatable ones and the
 * ones that never had a column. If you add a broadcast to the scraper, give it
 * a `kind` and add it here, or the checklist quietly under-reports. */
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
  const overdue = !sent && !row.notApplicable && row.dueAt != null && new Date(row.dueAt) < new Date();

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
      : overdue
        ? {
            icon: <AlertTriangle className="size-3.5" />,
            tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
            text: "text-amber-700 dark:text-amber-400",
            // the cron ticks every few minutes, so "past due and still unsent"
            // means something is stuck - worth flagging, not hiding
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
    <ul className="glass-surface flex flex-col gap-3 rounded-xl border p-3">
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
  reminderSentAt,
  lockNotifiedAt,
  followupNotifiedAt,
  fotnReminderSentAt,
  payoutAllPaidNotifiedAt,
  gradedFights,
  countableFights,
  log,
}: {
  eventDate: string;
  lockAt: string | null;
  status: string;
  payoutsEnabled: boolean;
  hypeNotifiedAt: string | null;
  cardNotifiedAt: string | null;
  reminderSentAt: string | null;
  lockNotifiedAt: string | null;
  followupNotifiedAt: string | null;
  fotnReminderSentAt: string | null;
  payoutAllPaidNotifiedAt: string | null;
  gradedFights: number;
  countableFights: number;
  log: PushLogEntry[];
}) {
  const completed = status === "completed";

  // newest first, so `last` is simply the head
  const byKind = new Map<string, PushLogEntry[]>();
  for (const entry of log) {
    byKind.set(entry.kind, [...(byKind.get(entry.kind) ?? []), entry]);
  }
  const last = (kind: string) => byKind.get(kind)?.[0]?.sent_at ?? null;
  const count = (kind: string) => byKind.get(kind)?.length ?? 0;
  const reach = (kind: string) => byKind.get(kind)?.[0]?.recipients ?? null;

  /** "Odesláno 12. 6. 14:00 · 11 lidem", when the log knows the headcount. */
  const withReach = (kind: string, sentAt: string | null) => {
    if (!sentAt) return undefined;
    const people = reach(kind);
    return people == null ? undefined : `Odesláno ${fmt(sentAt)} · ${people} lidem`;
  };

  // Mirrors cron.py: HYPE_DAYS_BEFORE=6 at 14:00, PUBLISH_DAYS_BEFORE=3 at
  // 9:00, FOLLOWUP_DAYS_AFTER=1 at 14:00 - all Prague wall-clock.
  const hypeAt = pragueDaysBeforeIso(eventDate, 6, 14);
  const cardAt = pragueDaysBeforeIso(eventDate, 3, 9);
  const followupAt = pragueDaysBeforeIso(eventDate, -1, 14);

  const changed = count("card_changed");
  const resultPushes = count("fight_result");

  const broadcasts: Row[] = [
    {
      key: "hype",
      label: "Upoutávka na YouTube",
      detail: "Všem · 6 dní předem ve 14:00, odkaz na kanál OKTAGONu",
      sentAt: hypeNotifiedAt ?? last("hype"),
      dueAt: hypeAt,
      note: withReach("hype", hypeNotifiedAt ?? last("hype")),
    },
    {
      key: "card",
      label: "Karta je online",
      detail: "Všem · jakmile se naimportují zápasy zveřejněného galavečera",
      sentAt: cardNotifiedAt ?? last("card_online"),
      dueAt: status === "draft" ? cardAt : null,
      note: withReach("card_online", cardNotifiedAt ?? last("card_online")),
    },
    {
      key: "card-changed",
      label: "Karta se změnila",
      detail: "Všem · při kontrole karty (každé 3 h), když přibyl nebo odpadl zápas",
      // the one broadcast that can legitimately fire more than once per gala,
      // so it gets a count rather than a single timestamp
      done: changed > 0,
      note:
        changed === 0
          ? "Zatím neodesláno"
          : `Odesláno ${changed}× · naposled ${fmt(last("card_changed")!)}`,
    },
    {
      key: "reminder",
      label: "Připomínka před uzávěrkou",
      detail: "Všem · hodinu před zámkem, každému s vlastním počtem „X z Y“",
      sentAt: reminderSentAt ?? last("lock_reminder"),
      dueAt: lockAt ? new Date(new Date(lockAt).getTime() - 60 * 60 * 1000).toISOString() : null,
      note: withReach("lock_reminder", reminderSentAt ?? last("lock_reminder")),
    },
    {
      key: "lock",
      label: "Tipy uzavřeny",
      detail: "Všem · v okamžiku uzávěrky, odkaz na žebříček",
      sentAt: lockNotifiedAt ?? last("lock"),
      dueAt: lockAt,
      note: withReach("lock", lockNotifiedAt ?? last("lock")),
    },
    {
      key: "results",
      label: "Výsledky zápasů",
      detail: "Tipérům na daný zápas · průběžně, jak se zápasy bodují",
      done: countableFights > 0 && gradedFights >= countableFights,
      note:
        countableFights === 0
          ? "Karta ještě není"
          : `Odbodováno ${gradedFights} z ${countableFights} zápasů` +
            (resultPushes > 0 ? ` · ${resultPushes}× rozeslán výsledek` : ""),
    },
    {
      key: "results-done",
      label: "Výsledky jsou hotové",
      detail: "Všem · když se galavečer uzavře (u startovného i s QR platbou)",
      sentAt: last("results_done"),
      // galas graded before the push log existed have no row - fall back to the
      // same condition the cron uses so they don't look like a missed send
      done: completed,
      note: last("results_done")
        ? withReach("results_done", last("results_done"))
        : completed
          ? "Odesláno při uzavření galavečera"
          : "Čeká na uzavření galavečera",
    },
    {
      key: "followup",
      label: "Ohlédnutí za galavečerem",
      detail: "Všem · den po galavečeru ve 14:00, plus pozvánka na další",
      sentAt: followupNotifiedAt ?? last("followup"),
      dueAt: followupAt,
      note: withReach("followup", followupNotifiedAt ?? last("followup")),
    },
    {
      key: "comments",
      label: "Nové zprávy v kecárně",
      detail: "Všem kromě autorů · sloučené za každý tik cronu",
      done: count("comments") > 0,
      note: count("comments") === 0 ? "Zatím neodesláno" : `Odesláno ${count("comments")}×`,
    },
  ];

  const personal: Row[] = [
    {
      key: "fotn",
      label: "Chybí Fight of the Night",
      detail: "Jen adminům · když jsou všechny zápasy odbodované a FOTN chybí",
      sentAt: fotnReminderSentAt ?? last("fotn_missing"),
    },
    {
      key: "payout-win",
      label: "Vyhrál jsi startovné",
      detail: "Jen vítězi · při uzavření, pokud nemá vyplněné číslo účtu",
      sentAt: last("payout_win"),
      notApplicable: payoutsEnabled ? undefined : "Galavečer je bez startovného",
      note: payoutsEnabled && !last("payout_win") ? "Neodesláno (vítěz měl účet vyplněný)" : undefined,
    },
    {
      key: "payout-settled",
      label: "Startovné vyplaceno",
      detail: "Jen vítězi · jakmile se všichni odškrtnou jako zaplacení",
      sentAt: payoutAllPaidNotifiedAt ?? last("payout_settled"),
      notApplicable: payoutsEnabled ? undefined : "Galavečer je bez startovného",
    },
  ];

  return (
    <Section title="Notifikace" icon={<Megaphone className="size-4" />} className="gap-3">
      <List rows={broadcasts} />

      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        Nehromadné
      </p>
      <List rows={personal} />

      {log.length > 0 && (
        <Disclosure
          className="glass-surface rounded-xl border"
          summaryClassName="p-3 text-sm font-semibold"
          summary={`Co přesně odešlo (${log.length})`}
        >
          <ul className="flex flex-col gap-2 px-3 pb-3">
            {log.map((entry, i) => (
              <li key={`${entry.kind}-${entry.sent_at}-${i}`} className="flex flex-col">
                <span className="truncate text-xs font-medium">{entry.title}</span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {fmt(entry.sent_at)} · {entry.recipients} lidem
                </span>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Odeslání se zapisuje do push logu — u galavečerů z doby před jeho zavedením se opírá jen o
        značky na eventu, takže tam počty chybí. Jednorázový vlastní text pošleš přes „Poslat
        upozornění“ v přehledu adminu.
      </p>
    </Section>
  );
}
