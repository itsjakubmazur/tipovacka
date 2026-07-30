import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventSettingsForm } from "@/components/admin/event-settings-form";
import { AddFightForm } from "@/components/admin/add-fight-form";
import { AdminFightRow } from "@/components/admin/admin-fight-row";
import { AdminFotnForm } from "@/components/admin/admin-fotn-form";
import { NotificationChecklist } from "@/components/admin/notification-checklist";
import { Section } from "@/components/ui/section-heading";
import { ImportSherdogButton } from "@/components/admin/import-sherdog-button";

export default async function AdminEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/");
  }

  const { data: event } = await supabase
    .from("events")
    .select(
      `id, number, name, subtitle, subtitle_locked, location, event_date, status, lock_at,
       auto_lock, actual_fotn_fight_id, payouts_enabled,
       hype_notified_at, card_notified_at, reminder_sent_at, lock_notified_at,
       followup_notified_at, fotn_reminder_sent_at, payout_all_paid_notified_at`
    )
    .eq("id", id)
    .single();

  if (!event) {
    notFound();
  }

  const { data: fights } = await supabase
    .from("fights")
    .select(
      `id, card_order, rounds, status, winner_fighter_id, method, result_round,
       fighter_a:fighters!fights_fighter_a_id_fkey(id, name),
       fighter_b:fighters!fights_fighter_b_id_fkey(id, name)`
    )
    .eq("event_id", id)
    .order("card_order", { ascending: true });

  // Newest first: the checklist wants "last time this kind went out".
  const { data: pushLog } = await supabase
    .from("push_log")
    .select("kind, title, recipients, sent_at")
    .eq("event_id", id)
    .order("sent_at", { ascending: false });

  const { data: fighters } = await supabase
    .from("fighters")
    .select("id, name")
    .order("name", { ascending: true });

  const fightIds = (fights ?? []).map((f) => f.id);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nickname")
    .order("nickname", { ascending: true });

  const { data: predictions } = await supabase
    .from("predictions")
    .select("user_id, fight_id")
    .in("fight_id", fightIds.length ? fightIds : ["00000000-0000-0000-0000-000000000000"]);

  // The Fight of the Night pick is scored too, so "kdo má natipováno" has to
  // account for it - otherwise someone shows as complete while missing a
  // bonus worth 2 points and nobody can tell them.
  const { data: bonusPicks } = await supabase
    .from("bonus_predictions")
    .select("user_id")
    .eq("event_id", id);
  const fotnPickedBy = new Set((bonusPicks ?? []).map((b) => b.user_id));

  const tippedCountByUser = new Map<string, number>();
  for (const p of predictions ?? []) {
    tippedCountByUser.set(p.user_id, (tippedCountByUser.get(p.user_id) ?? 0) + 1);
  }

  const tipProgress = (profiles ?? [])
    .map((p) => ({
      id: p.id,
      nickname: p.nickname ?? "Bez přezdívky",
      tipped: tippedCountByUser.get(p.id) ?? 0,
      fotn: fotnPickedBy.has(p.id),
    }))
    .sort((a, b) => a.tipped - b.tipped || Number(a.fotn) - Number(b.fotn));

  const sortedFights = (fights ?? []) as unknown as {
    id: string;
    card_order: number;
    rounds: number;
    status: string;
    winner_fighter_id: string | null;
    method: "KO/TKO" | "SUBMISSION" | "DECISION" | null;
    result_round: number | null;
    fighter_a: { id: string; name: string };
    fighter_b: { id: string; name: string };
  }[];

  // "cancelled"/"no_contest" fights are excluded from scoring, so they never
  // produce a result push either.
  const countableFights = sortedFights.filter(
    (f) => f.status !== "cancelled" && f.status !== "no_contest"
  );

  const nextCardOrder =
    sortedFights.length > 0 ? Math.max(...sortedFights.map((f) => f.card_order)) + 1 : 1;

  return (
    <div className="flex flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-bold lg:text-3xl">
        {event.number ? `OKTAGON ${event.number}` : event.name}
      </h1>

      {/* From lg the forms and the fight list keep the wide column, while the
          read-only monitoring - draft note, who has tipped, the FOTN pick -
          moves into a sticky rail. Below lg the rail is display:contents. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-8">
        <aside className="contents lg:col-start-2 lg:row-start-1 lg:block">
          <div className="flex flex-col gap-6 lg:sticky lg:top-20 lg:-mx-3 lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:overscroll-contain lg:px-3 lg:pb-2">
            {/* First thing in the rail (and first on the page on a phone,
                where the rail is display:contents): everything else runs
                itself, so entering the Fight of the Night is the one reason
                anyone opens this screen. */}
            {sortedFights.length > 0 && (
              <Section title="Bonus tip">
                <AdminFotnForm
                  eventId={event.id}
                  fights={sortedFights}
                  initialFightId={event.actual_fotn_fight_id}
                />
              </Section>
            )}
            {event.status === "draft" && (
              <p className="rounded-xl border border-yellow-600/60 dark:border-accent/40 bg-accent/10 p-3 text-sm shadow-lg shadow-black/20 dark:shadow-black/60 text-neutral-700 dark:text-neutral-300">
                Tohle je jen návrh, skrytý tipérům. Zápasová karta se naimportuje a galavečer se
                automaticky zveřejní v 9:00 (český čas) 3 dny před začátkem, cca{" "}
                {new Date(
                  new Date(event.event_date).getTime() - 3 * 24 * 60 * 60 * 1000
                ).toLocaleDateString("cs-CZ", { dateStyle: "long", timeZone: "Europe/Prague" })}
                – nic není potřeba dělat ručně.
              </p>
            )}

            {sortedFights.length > 0 && (
              <Section title="Kdo má natipováno">
                {/* One card, one row per person - twelve separate cards for
                    "Jméno · FOTN · 4/10" was a wall of padding. */}
                <div className="divide-y divide-black/5 rounded-xl border border-white/45 bg-white/35 shadow-lg shadow-black/20 backdrop-blur-lg dark:divide-white/5 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
                  {tipProgress.map((p) => {
                    const fightsDone = p.tipped >= sortedFights.length;
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                        <span className="min-w-0 truncate">{p.nickname}</span>
                        <span className="flex shrink-0 items-center gap-3 font-semibold tabular-nums">
                          <span
                            className={
                              p.fotn
                                ? "text-green-700 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }
                            title="Tip na zápas večera"
                          >
                            {p.fotn ? "FOTN ✓" : "FOTN ✗"}
                          </span>
                          <span
                            className={
                              fightsDone
                                ? "text-green-700 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }
                          >
                            {p.tipped} / {sortedFights.length}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            <NotificationChecklist
              eventDate={event.event_date}
              lockAt={event.lock_at}
              status={event.status}
              payoutsEnabled={event.payouts_enabled}
              hypeNotifiedAt={event.hype_notified_at}
              cardNotifiedAt={event.card_notified_at}
              reminderSentAt={event.reminder_sent_at}
              lockNotifiedAt={event.lock_notified_at}
              followupNotifiedAt={event.followup_notified_at}
              fotnReminderSentAt={event.fotn_reminder_sent_at}
              payoutAllPaidNotifiedAt={event.payout_all_paid_notified_at}
              gradedFights={countableFights.filter((f) => f.status === "completed").length}
              countableFights={countableFights.length}
              log={pushLog ?? []}
            />

          </div>
        </aside>

        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-1 lg:min-w-0">
          <EventSettingsForm
            eventId={event.id}
            initialName={event.name}
            initialSubtitle={event.subtitle}
            initialSubtitleLocked={event.subtitle_locked ?? false}
            initialLocation={event.location}
            initialLockAt={event.lock_at}
            initialLocked={event.lock_at ? new Date(event.lock_at) <= new Date() : false}
            initialAutoLock={event.auto_lock}
            initialStatus={event.status}
            initialPayoutsEnabled={event.payouts_enabled}
          />

          <Section title="Zápasy" className="gap-3">
            <div className="flex flex-wrap gap-3">
              <ImportSherdogButton
                eventId={event.id}
                mode="card"
                label="Stáhnout kartu z OKTAGON API"
                disabled={!event.number}
              />
              <ImportSherdogButton
                eventId={event.id}
                mode="results"
                label="Stáhnout výsledky z OKTAGON API"
                disabled={!event.number}
              />
            </div>
            {!event.number && (
              <p className="text-sm text-neutral-500 dark:text-neutral-300">
                Nejdřív vyplň číslo OKTAGONu v nastavení galavečera výše.
              </p>
            )}
            <div className="flex flex-col gap-3">
              {sortedFights.map((fight, i) => (
                <AdminFightRow
                  key={fight.id}
                  fight={fight}
                  eventId={event.id}
                  neighborUp={i > 0 ? sortedFights[i - 1] : null}
                  neighborDown={i < sortedFights.length - 1 ? sortedFights[i + 1] : null}
                />
              ))}
            </div>
            <AddFightForm eventId={event.id} fighters={fighters ?? []} nextCardOrder={nextCardOrder} />
          </Section>

        </div>
      </div>
    </div>
  );
}
