import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventSettingsForm } from "@/components/admin/event-settings-form";
import { AddFightForm } from "@/components/admin/add-fight-form";
import { AdminFightRow } from "@/components/admin/admin-fight-row";
import { AdminFotnForm } from "@/components/admin/admin-fotn-form";
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
    .select("id, number, name, location, event_date, status, lock_at, auto_lock, actual_fotn_fight_id")
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

  const tippedCountByUser = new Map<string, number>();
  for (const p of predictions ?? []) {
    tippedCountByUser.set(p.user_id, (tippedCountByUser.get(p.user_id) ?? 0) + 1);
  }

  const tipProgress = (profiles ?? [])
    .map((p) => ({
      id: p.id,
      nickname: p.nickname ?? "Bez přezdívky",
      tipped: tippedCountByUser.get(p.id) ?? 0,
    }))
    .sort((a, b) => a.tipped - b.tipped);

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

  const nextCardOrder =
    sortedFights.length > 0 ? Math.max(...sortedFights.map((f) => f.card_order)) + 1 : 1;

  return (
    <div className="flex flex-col gap-6 px-4 py-8">
      <h1 className="text-xl font-bold">
        {event.number ? `OKTAGON ${event.number}` : event.name}
      </h1>

      {event.status === "draft" && (
        <p className="rounded-xl border border-[#FFD400]/40 bg-[#FFD400]/10 p-3 text-sm shadow-lg shadow-black/20 dark:shadow-black/60 text-neutral-700 dark:text-neutral-300">
          Tohle je jen návrh, skrytý tipérům. Zápasová karta se naimportuje a galavečer se
          automaticky zveřejní v 9:00 (český čas) 3 dny před začátkem, cca{" "}
          {new Date(
            new Date(event.event_date).getTime() - 3 * 24 * 60 * 60 * 1000
          ).toLocaleDateString("cs-CZ", { dateStyle: "long", timeZone: "Europe/Prague" })}
          – nic není potřeba dělat ručně.
        </p>
      )}

      {sortedFights.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Kdo má natipováno</h2>
          <div className="flex flex-col gap-2">
            {tipProgress.map((p) => {
              const complete = p.tipped >= sortedFights.length;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-white/60 bg-white/55 backdrop-blur-md p-3 shadow-lg shadow-black/20 dark:border-neutral-700/60 dark:bg-neutral-800/55 dark:shadow-black/60"
                >
                  <span>{p.nickname}</span>
                  <span
                    className={
                      complete
                        ? "text-sm font-semibold text-green-700"
                        : "text-sm font-semibold text-red-600"
                    }
                  >
                    {p.tipped} / {sortedFights.length}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <EventSettingsForm
        eventId={event.id}
        initialName={event.name}
        initialLocation={event.location}
        initialLockAt={event.lock_at}
        initialAutoLock={event.auto_lock}
        initialStatus={event.status}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Zápasy</h2>
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
      </section>

      {sortedFights.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Bonus tip</h2>
          <AdminFotnForm
            eventId={event.id}
            fights={sortedFights}
            initialFightId={event.actual_fotn_fight_id}
          />
        </section>
      )}
    </div>
  );
}
