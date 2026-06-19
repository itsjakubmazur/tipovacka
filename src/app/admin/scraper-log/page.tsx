import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const MODE_LABELS: Record<string, string> = {
  card: "Karta",
  results: "Výsledky",
  fightmatrix: "Fight Matrix",
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
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/");
  }

  const { data: runs } = await supabase
    .from("scraper_runs")
    .select("id, mode, event_id, status, message, started_at, finished_at, events(number, name)")
    .order("started_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col gap-4 px-4 py-8">
      <h1 className="text-xl font-bold">Log scraperu</h1>

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
                "flex flex-col gap-1 rounded-xl border p-3 text-sm",
                run.status === "error"
                  ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40"
                  : "border-neutral-200 dark:border-neutral-800"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {MODE_LABELS[run.mode] ?? run.mode}
                  {event && (
                    <span className="ml-2 font-normal text-neutral-500 dark:text-neutral-400">
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
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
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
