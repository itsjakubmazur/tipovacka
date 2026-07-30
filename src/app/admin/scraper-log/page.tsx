import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const MODE_LABELS: Record<string, string> = {
  card: "Karta",
  results: "Výsledky",
  scheduled_results: "Výsledky (plán)",
};

const STATUS_LABELS: Record<string, string> = {
  running: "Běží…",
  success: "OK",
  error: "Chyba",
};

export default async function ScraperLogPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_superadmin) {
    redirect("/");
  }

  const [{ data: runs }, { data: heartbeat }, { data: activeEvents }] = await Promise.all([
    supabase
      .from("scraper_runs")
      .select("id, mode, event_id, status, message, started_at, finished_at, events(number, name)")
      .order("started_at", { ascending: false })
      .limit(50),
    supabase.from("cron_heartbeat").select("last_run_at").eq("id", 1).maybeSingle(),
    supabase
      .from("events")
      .select("id, number, name, fights(card_order, status)")
      .not("status", "in", "(draft,completed)"),
  ]);

  // Safety net: since the reorder is atomic now, duplicate card_order values
  // shouldn't happen - but if one ever slips in, surface it here rather than
  // letting the card render in a confusing order.
  const cardIssues: string[] = [];
  for (const ev of (activeEvents ?? []) as unknown as {
    number: number | null;
    name: string;
    fights: { card_order: number; status: string }[];
  }[]) {
    const orders = (ev.fights ?? [])
      .filter((f) => f.status !== "cancelled")
      .map((f) => f.card_order);
    const dupes = orders.filter((o, i) => orders.indexOf(o) !== i);
    if (dupes.length > 0) {
      cardIssues.push(ev.number ? `OKTAGON ${ev.number}` : ev.name);
    }
  }

  const lastRun = heartbeat?.last_run_at ? new Date(heartbeat.last_run_at) : null;
  const ageMinutes = lastRun ? (new Date().getTime() - lastRun.getTime()) / 60000 : null;
  // A couple of missed ticks is normal jitter; flag only a real gap.
  const stale = ageMinutes != null && ageMinutes > 30;

  return (
    <div className="stagger-in flex flex-col gap-4 px-4 py-8">
      <h1 className="text-xl font-bold lg:text-3xl">Log scraperu</h1>

      <div
        className={cn(
          "flex items-center gap-2 overflow-hidden rounded-xl border px-3 py-2 text-sm shadow-lg shadow-black/20 dark:shadow-black/60",
          lastRun == null || stale
            ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
            : "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
        )}
      >
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            lastRun == null || stale ? "bg-red-500" : "bg-green-500"
          )}
        />
        <span className="shrink-0 font-semibold">
          {lastRun == null ? "Scraper zatím neběžel" : stale ? "Scraper možná stojí" : "Scraper běží"}
        </span>
        {lastRun && (
          <span className="ml-auto truncate whitespace-nowrap text-xs text-neutral-500 dark:text-neutral-300">
            {lastRun.toLocaleString("cs-CZ", {
              day: "numeric",
              month: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/Prague",
            })}
          </span>
        )}
      </div>

      {cardIssues.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40">
          <span className="font-semibold text-red-700 dark:text-red-400">
            Pozor: duplicitní pořadí zápasů
          </span>
          <span className="text-neutral-600 dark:text-neutral-300">
            {" "}na kartě {cardIssues.join(", ")}. Zkontroluj pořadí v administraci.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {(runs ?? []).length === 0 && (
          <p className="text-neutral-600 dark:text-neutral-400">Zatím žádné běhy scraperu.</p>
        )}
        {(runs ?? []).map((run) => {
          const event = run.events as unknown as { number: number | null; name: string } | null;
          return (
            <div
              key={run.id}
              className={cn(
                "flex flex-col gap-1 rounded-xl border p-3 text-sm shadow-lg shadow-black/20 dark:shadow-black/60",
                run.status === "error"
                  ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40"
                  : "border-white/45 bg-white/35 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {MODE_LABELS[run.mode] ?? run.mode}
                  {event && (
                    <span className="ml-2 font-normal text-neutral-500 dark:text-neutral-300">
                      {event.number ? `OKTAGON ${event.number}` : event.name}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "font-semibold",
                    run.status === "error" ? "text-red-600" : "text-neutral-700 dark:text-neutral-300"
                  )}
                >
                  {STATUS_LABELS[run.status] ?? run.status}
                </span>
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-300">
                {new Date(run.started_at).toLocaleString("cs-CZ", {
                  dateStyle: "short",
                  timeStyle: "medium",
                  timeZone: "Europe/Prague",
                })}
              </span>
              {run.message && <p className="text-xs text-red-600">{run.message}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
