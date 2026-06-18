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

  return (
    <div className="flex flex-col gap-4 px-4 py-8">
      <h1 className="text-xl font-bold">Galavečery</h1>

      {!events?.length && <p className="text-neutral-600">Žádné galavečery zatím nejsou.</p>}

      <div className="flex flex-col gap-3">
        {events?.map((event) => {
          const locked = event.lock_at ? new Date(event.lock_at) <= new Date() : false;
          const effectiveStatus = event.status === "completed" ? "completed" : locked ? "locked" : "upcoming";
          return (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="flex items-center justify-between rounded-xl border border-neutral-200 p-4 hover:border-neutral-400"
            >
              <div>
                <p className="font-semibold">
                  {event.number ? `OKTAGON ${event.number}` : event.name}
                </p>
                <p className="text-sm text-neutral-600">{event.location}</p>
                <p className="text-sm text-neutral-500">
                  {new Date(event.event_date).toLocaleString("cs-CZ", {
                    dateStyle: "long",
                    timeStyle: "short",
                  })}
                </p>
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
