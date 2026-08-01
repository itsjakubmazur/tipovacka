import Link from "next/link";
import { redirect } from "next/navigation";
import { BackLink } from "@/components/ui/back-link";
import { createClient } from "@/lib/supabase/server";
import { loadSeasonStats, seasonBadges } from "@/lib/season-stats";
import { tipperArchetype } from "@/lib/tipper-archetype";
import { buildScenes } from "@/lib/wrapped-scenes";
import { WrappedPlayer } from "@/components/wrapped/wrapped-player";

/** Personal season recap ("Wrapped") - a sequence of full-screen scenes you
 * tap through, backed by the season's own gala posters, ending in a share
 * card. All of it comes out of loadSeasonStats, the same engine the tipper
 * detail page reads from. */
export default async function WrappedPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const { season: rawSeason } = await searchParams;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  const season = rawSeason ? Number(rawSeason) : new Date().getFullYear();

  const [{ data: profile }, stats] = await Promise.all([
    supabase.from("profiles").select("nickname").eq("id", user.id).single(),
    loadSeasonStats(supabase, user.id, season),
  ]);
  const nickname = profile?.nickname ?? "Bez přezdívky";

  if (stats.nights.length === 0) {
    return (
      <div className="flex flex-col gap-4 px-4 py-8">
        <div>
          <BackLink href="/leaderboard">Zpět na žebříček</BackLink>
          <h1 className="mt-1 text-xl font-bold lg:text-3xl">Tvoje sezóna {season}</h1>
        </div>
        <p className="text-neutral-600 dark:text-neutral-400">
          V sezóně {season} zatím nemáš žádný vyhodnocený galavečer.
        </p>
      </div>
    );
  }

  const archetype = tipperArchetype(stats);
  const badges = seasonBadges(stats);

  const query = new URLSearchParams({
    season: String(season),
    nick: nickname,
    points: String(stats.totalPoints),
    type: archetype.name,
    code: archetype.code,
  });
  if (stats.seasonRank != null) query.set("rank", String(stats.seasonRank));
  if (stats.seasonTotal != null) query.set("total", String(stats.seasonTotal));
  if (stats.eventWins > 0) query.set("wins", String(stats.eventWins));
  if (stats.totalGraded > 0) query.set("acc", String(stats.accuracy));
  if (stats.best) query.set("best", `${stats.best.event.label} (${stats.best.points} b.)`);
  if (stats.balance != null) query.set("balance", String(stats.balance));
  for (const poster of stats.nights
    .map((night) => night.event.imageUrl)
    .filter((url): url is string => Boolean(url))
    .slice(0, 6)) {
    query.append("poster", poster);
  }

  const scenes = buildScenes(stats, archetype, nickname, badges, `/share/wrapped?${query}`);
  const posters = stats.nights
    .map((night) => night.event.imageUrl)
    .filter((url): url is string => Boolean(url));

  return (
    <div className="animate-page-in md:px-4 md:pt-2">
      <WrappedPlayer scenes={scenes} posters={posters} />
      <div className="flex justify-center px-4 py-3">
        <Link
          href="/leaderboard"
          className="text-sm text-neutral-500 underline-offset-4 hover:underline dark:text-neutral-400"
        >
          Zpět na žebříček
        </Link>
      </div>
    </div>
  );
}
