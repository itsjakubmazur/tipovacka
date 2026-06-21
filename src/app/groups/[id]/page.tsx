import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type GroupLeaderboardRow = {
  user_id: string;
  nickname: string | null;
  points: number;
  fights_correct_winner: number;
  perfect_cards: number;
  earliest_prediction_at: string | null;
};

export default async function GroupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { id } = await params;
  const { season: rawSeason } = await searchParams;
  const season = rawSeason ? Number(rawSeason) : new Date().getFullYear();

  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/login");
  }

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, invite_code")
    .eq("id", id)
    .single();

  if (!group) {
    notFound();
  }

  const { data: rows } = await supabase
    .from("group_season_leaderboard")
    .select("user_id, nickname, points, fights_correct_winner, perfect_cards, earliest_prediction_at")
    .eq("group_id", id)
    .eq("season", season)
    .order("points", { ascending: false })
    .order("fights_correct_winner", { ascending: false })
    .order("perfect_cards", { ascending: false })
    .order("earliest_prediction_at", { ascending: true, nullsFirst: false });

  const leaderboardRows: GroupLeaderboardRow[] = rows ?? [];
  const currentUserId = userData.user.id;

  return (
    <div className="flex flex-col gap-4 px-4 py-8">
      <div>
        <Link href="/groups" className="text-sm text-neutral-500 dark:text-neutral-300 hover:text-black">
          ← Zpět na skupiny
        </Link>
        <h1 className="mt-1 text-xl font-bold">{group.name}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Kód pro pozvání kámošů: <span className="font-mono font-semibold">{group.invite_code}</span>
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-300">Sezóna {season}</p>
      </div>

      <div className="flex flex-col gap-2">
        {leaderboardRows.length === 0 && (
          <p className="text-neutral-600 dark:text-neutral-400">Žádný člen skupiny zatím nemá body v této sezóně.</p>
        )}
        {leaderboardRows.map((row, i) => (
          <Link
            key={row.user_id}
            href={`/leaderboard/u/${row.user_id}?season=${season}`}
            className={cn(
              "flex items-center justify-between rounded-xl border p-3 shadow-lg shadow-black/20 transition-shadow hover:shadow-xl transition-colors hover:border-neutral-400 dark:shadow-black/60",
              row.user_id === currentUserId
                ? "border-[#FFD400] bg-[#FFFBE6] dark:bg-[#3C3722]"
                : "border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
            )}
          >
            <div className="flex items-center gap-3">
              <span className="w-6 text-center text-sm font-bold text-neutral-500 dark:text-neutral-300">{i + 1}.</span>
              <span className="font-semibold">{row.nickname ?? "Bez přezdívky"}</span>
            </div>
            <span className="text-lg font-bold">{row.points}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
