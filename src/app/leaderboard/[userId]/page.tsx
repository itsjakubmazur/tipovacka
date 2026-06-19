import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TipBreakdownCard } from "@/components/predictions/tip-breakdown-card";
import { cn } from "@/lib/utils";
import type { Fight, Prediction } from "@/lib/types";

type EventLeaderboardRow = {
  event_id: string;
  points: number;
  fights_scored: number;
  fights_completed: number;
};

export default async function TipperDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ eventId?: string; season?: string }>;
}) {
  const { userId } = await params;
  const { eventId, season: rawSeason } = await searchParams;

  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", userId)
    .single();

  if (!profile) {
    notFound();
  }

  if (eventId) {
    const { data: event } = await supabase
      .from("events")
      .select("id, number, name, event_date, status, lock_at")
      .eq("id", eventId)
      .single();

    if (!event) {
      notFound();
    }

    const locked =
      event.status === "completed" ||
      (event.lock_at ? new Date(event.lock_at) <= new Date() : false);

    const { data: fights } = await supabase
      .from("fights")
      .select(
        `id, weight_class, is_title_fight, is_main_event, card_order, rounds, status,
         winner_fighter_id, method, result_round,
         fighter_a:fighters!fights_fighter_a_id_fkey(id, name, nickname, photo_url, record, fightmatrix_rank, fightmatrix_score, nationality, flag_code),
         fighter_b:fighters!fights_fighter_b_id_fkey(id, name, nickname, photo_url, record, fightmatrix_rank, fightmatrix_score, nationality, flag_code)`
      )
      .eq("event_id", eventId)
      .order("card_order", { ascending: false });

    const fightIds = (fights ?? []).map((f) => f.id);

    const { data: predictions } = await supabase
      .from("predictions")
      .select("fight_id, predicted_winner_id, predicted_method, predicted_round, points")
      .eq("user_id", userId)
      .in("fight_id", fightIds.length ? fightIds : ["00000000-0000-0000-0000-000000000000"]);

    const predictionByFight = new Map<string, Prediction>(
      (predictions ?? []).map((p) => [p.fight_id, p])
    );

    return (
      <div className="flex flex-col gap-4 px-4 py-8">
        <div>
          <Link href="/leaderboard" className="text-sm text-neutral-500 hover:text-black">
            ← Zpět na žebříček
          </Link>
          <h1 className="mt-1 text-xl font-bold">{profile.nickname ?? "Bez přezdívky"}</h1>
          <p className="text-sm text-neutral-600">
            {event.number ? `OKTAGON ${event.number}` : event.name}
          </p>
        </div>

        {!locked ? (
          <p className="text-neutral-600">Tipy se zobrazí až po uzávěrce galavečera.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {(fights ?? []).map((fight) => (
              <TipBreakdownCard
                key={fight.id}
                fight={fight as unknown as Fight}
                prediction={predictionByFight.get(fight.id) ?? null}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const season = rawSeason ? Number(rawSeason) : new Date().getFullYear();

  const { data: seasonEvents } = await supabase
    .from("events")
    .select("id, number, name, event_date")
    .order("event_date", { ascending: false });

  const eventsInSeason = (seasonEvents ?? []).filter(
    (e) => new Date(e.event_date).getFullYear() === season
  );
  const eventIds = eventsInSeason.map((e) => e.id);

  const { data: rows } = await supabase
    .from("event_leaderboard")
    .select("event_id, points, fights_scored, fights_completed")
    .eq("user_id", userId)
    .in("event_id", eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"]);

  const rowByEvent = new Map<string, EventLeaderboardRow>(
    (rows ?? []).map((r) => [r.event_id, r])
  );
  const totalPoints = (rows ?? []).reduce((sum, r) => sum + r.points, 0);

  return (
    <div className="flex flex-col gap-4 px-4 py-8">
      <div>
        <Link href="/leaderboard" className="text-sm text-neutral-500 hover:text-black">
          ← Zpět na žebříček
        </Link>
        <h1 className="mt-1 text-xl font-bold">{profile.nickname ?? "Bez přezdívky"}</h1>
        <p className="text-sm text-neutral-600">
          Sezóna {season} · celkem {totalPoints} b.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {eventsInSeason.map((event) => {
          const row = rowByEvent.get(event.id);
          return (
            <Link
              key={event.id}
              href={`/leaderboard/${userId}?eventId=${event.id}`}
              className={cn(
                "flex items-center justify-between rounded-xl border border-neutral-200 p-3 hover:border-neutral-400"
              )}
            >
              <span className="font-semibold">
                {event.number ? `OKTAGON ${event.number}` : event.name}
              </span>
              <span className="flex items-center gap-3 text-sm text-neutral-500">
                {row ? `po ${row.fights_scored} z ${row.fights_completed} zápasů` : "bez tipů"}
                <span className="text-lg font-bold text-black">{row?.points ?? 0}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
