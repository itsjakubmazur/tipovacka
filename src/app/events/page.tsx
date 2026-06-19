import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<string, string> = {
  upcoming: "Chystá se",
  locked: "Uzamčeno",
  completed: "Vyhodnoceno",
};

export default async function EventsPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, number, name, event_date, location, status, lock_at")
    .order("event_date", { ascending: false });

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  const { data: fights } = await supabase.from("fights").select("id, event_id");

  const fightCountByEvent = new Map<string, number>();
  (fights ?? []).forEach((f) =>
    fightCountByEvent.set(f.event_id, (fightCountByEvent.get(f.event_id) ?? 0) + 1)
  );

  const predictionCountByEvent = new Map<string, number>();
  if (user) {
    const fightToEvent = new Map((fights ?? []).map((f) => [f.id, f.event_id]));
    const { data: predictions } = await supabase
      .from("predictions")
      .select("fight_id")
      .eq("user_id", user.id);
    (predictions ?? []).forEach((p) => {
      const eventId = fightToEvent.get(p.fight_id);
      if (eventId) {
        predictionCountByEvent.set(eventId, (predictionCountByEvent.get(eventId) ?? 0) + 1);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-8">
      <h1 className="text-xl font-bold">Galavečery</h1>

      {!events?.length && <p className="text-neutral-600 dark:text-neutral-400">Žádné galavečery zatím nejsou.</p>}

      <div className="flex flex-col gap-3">
        {events?.map((event) => {
          const locked = event.lock_at ? new Date(event.lock_at) <= new Date() : false;
          const effectiveStatus = event.status === "completed" ? "completed" : locked ? "locked" : "upcoming";
          const totalFights = fightCountByEvent.get(event.id) ?? 0;
          const tippedCount = predictionCountByEvent.get(event.id) ?? 0;
          return (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="flex items-center justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 hover:border-neutral-400"
            >
              <div>
                <p className="font-semibold">
                  {event.number ? `OKTAGON ${event.number}` : event.name}
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{event.location}</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-300">
                  {new Date(event.event_date).toLocaleString("cs-CZ", {
                    dateStyle: "long",
                    timeStyle: "short",
                    timeZone: "Europe/Prague",
                  })}
                </p>
                {user && !locked && totalFights > 0 && (
                  <p className="text-sm text-neutral-500 dark:text-neutral-300">
                    Tipnuto {tippedCount} z {totalFights} zápasů
                  </p>
                )}
              </div>
              <Badge variant={effectiveStatus === "upcoming" ? "accent" : "secondary"}>
                {STATUS_LABELS[effectiveStatus]}
              </Badge>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
