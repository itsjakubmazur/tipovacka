import Link from "next/link";
import { BackLink } from "@/components/ui/back-link";
import { notFound, redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RankMedal } from "@/components/leaderboard/rank-medal";
import { GroupDetailActions } from "@/components/groups/group-detail-actions";
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

  const [{ data: rows }, { data: memberRows }] = await Promise.all([
    supabase
      .from("group_season_leaderboard")
      .select("user_id, nickname, points, fights_correct_winner, perfect_cards, earliest_prediction_at")
      .eq("group_id", id)
      .eq("season", season)
      .order("points", { ascending: false })
      .order("fights_correct_winner", { ascending: false })
      .order("perfect_cards", { ascending: false })
      .order("earliest_prediction_at", { ascending: true, nullsFirst: false }),
    // Full roster (incl. members with no points yet), which the scoring
    // board above hides.
    supabase
      .from("group_members")
      .select("user_id, profiles(nickname)")
      .eq("group_id", id),
  ]);

  const leaderboardRows: GroupLeaderboardRow[] = rows ?? [];
  const currentUserId = userData.user.id;

  const members = (
    (memberRows ?? []) as unknown as { user_id: string; profiles: { nickname: string | null } | null }[]
  ).map((m) => ({ userId: m.user_id, nickname: m.profiles?.nickname ?? "Bez přezdívky" }));
  const scoredIds = new Set(leaderboardRows.map((r) => r.user_id));
  const unscoredMembers = members.filter((m) => !scoredIds.has(m.userId));

  return (
    <div className="flex flex-col gap-4 px-4 py-8">
      <div className="flex flex-col gap-3">
        <div>
          <BackLink href="/groups">Zpět na skupiny</BackLink>
          <h1 className="mt-1 text-xl font-bold">{group.name}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-300">
            Sezóna {season} · {members.length} {members.length === 1 ? "člen" : members.length <= 4 ? "členové" : "členů"}
          </p>
        </div>
        <GroupDetailActions
          groupId={group.id}
          groupName={group.name}
          inviteCode={group.invite_code}
          userId={currentUserId}
        />
      </div>

      <div className="flex flex-col gap-2">
        {leaderboardRows.length === 0 && unscoredMembers.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 py-10 text-center dark:border-neutral-700">
            <Users className="size-8 text-neutral-400 dark:text-neutral-500" />
            <p className="font-medium">Zatím tu nikdo není</p>
            <p className="max-w-xs text-sm text-neutral-500 dark:text-neutral-400">
              Pošli kámošům zvací kód výše a poměřte se, kdo tipuje líp.
            </p>
          </div>
        )}
        {leaderboardRows.length > 0 && (
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Pořadí v sezóně
          </p>
        )}
        {leaderboardRows.map((row, i) => (
          <Link
            key={row.user_id}
            href={`/leaderboard/u/${row.user_id}?season=${season}`}
            className={cn(
              "flex items-center justify-between rounded-xl border p-3 shadow-lg shadow-black/20 transition hover:border-white/80 hover:shadow-xl dark:shadow-black/60",
              row.user_id === currentUserId
                ? "border-accent bg-accent/15"
                : "border-white/45 bg-white/35 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:hover:border-neutral-500/80"
            )}
          >
            <div className="flex items-center gap-3">
              <RankMedal rank={i + 1} />
              <span className="font-semibold">{row.nickname ?? "Bez přezdívky"}</span>
            </div>
            <span className="text-lg font-bold">{row.points}</span>
          </Link>
        ))}

        {unscoredMembers.length > 0 && (
          <>
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Členové bez bodů v sezóně
            </p>
            <div className="flex flex-wrap gap-2">
              {unscoredMembers.map((m) => (
                <Link
                  key={m.userId}
                  href={`/leaderboard/u/${m.userId}?season=${season}`}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    m.userId === currentUserId
                      ? "border-accent bg-accent/15 font-medium"
                      : "border-neutral-300 hover:border-accent dark:border-neutral-700"
                  )}
                >
                  {m.nickname}
                  {m.userId === currentUserId && " (ty)"}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
