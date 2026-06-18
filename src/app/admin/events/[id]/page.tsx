import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EventSettingsForm } from "@/components/admin/event-settings-form";
import { AddFightForm } from "@/components/admin/add-fight-form";
import { AdminFightRow } from "@/components/admin/admin-fight-row";
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
    .select("id, number, name, status, lock_at, auto_lock, sherdog_event_url")
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

      <EventSettingsForm
        eventId={event.id}
        initialLockAt={event.lock_at}
        initialAutoLock={event.auto_lock}
        initialStatus={event.status}
        initialSherdogUrl={event.sherdog_event_url}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Zápasy</h2>
        <div className="flex flex-wrap gap-3">
          <ImportSherdogButton
            eventId={event.id}
            mode="card"
            label="Stáhnout kartu ze Sherdogu"
            disabled={!event.sherdog_event_url}
          />
          <ImportSherdogButton
            eventId={event.id}
            mode="results"
            label="Stáhnout výsledky ze Sherdogu"
            disabled={!event.sherdog_event_url}
          />
        </div>
        {!event.sherdog_event_url && (
          <p className="text-sm text-neutral-500">
            Nejdřív vyplň odkaz na Sherdog v nastavení galavečera výše.
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
    </div>
  );
}
