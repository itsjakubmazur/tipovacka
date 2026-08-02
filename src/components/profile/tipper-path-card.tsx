import { Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Section } from "@/components/ui/section-heading";
import { TIERS, tipperPath } from "@/lib/tipper-path";
import { cn } from "@/lib/utils";

/** Where you are on the season's ladder, and how far the next title is.
 *
 * The one thing the app was missing between galas: points accumulate all
 * season but nothing ever said what they were adding up to. */
export async function TipperPathCard({ userId }: { userId: string }) {
  const supabase = await createClient();
  const season = new Date().getFullYear();

  const { data: row } = await supabase
    .from("season_leaderboard")
    .select("points")
    .eq("season", season)
    .eq("user_id", userId)
    .maybeSingle();

  const points = row?.points ?? 0;
  const { tier, tierIndex, next, toNext, fraction } = tipperPath(points);

  return (
    <Section title="Cesta tipéra" icon={<Trophy className="size-4" />}>
      <div className="glass-surface flex flex-col gap-3 rounded-xl border p-4">
        <p className="text-sm">
          Jsi <strong className="text-yellow-700 dark:text-accent">{tier.name}</strong>
          {next ? (
            <>
              {" "}
              · do titulu <strong>{next.name}</strong> ti chybí <strong>{toNext} b.</strong>
            </>
          ) : (
            <> · vyšš už to nejde, sezóna {season} je tvoje</>
          )}
        </p>

        <div className="flex flex-col gap-2">
          {/* the rail sits behind the dots, filled up to the current rung plus
              however far into it you've got */}
          <div className="relative">
            <span className="absolute inset-x-0 top-[7px] h-1 rounded-full bg-black/10 dark:bg-white/10" />
            <span
              className="absolute left-0 top-[7px] h-1 rounded-full bg-accent transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{
                width: `${((tierIndex + (next ? fraction : 0)) / (TIERS.length - 1)) * 100}%`,
              }}
            />
            <div className="relative flex justify-between">
              {TIERS.map((t, i) => (
                <span
                  key={t.name}
                  className={cn(
                    "size-[15px] rounded-full border-2 bg-background",
                    i < tierIndex && "border-accent bg-accent",
                    i === tierIndex &&
                      "border-accent bg-accent shadow-[0_0_0_4px_rgba(255,212,0,0.25)]",
                    i > tierIndex && "border-neutral-300 dark:border-neutral-600"
                  )}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-between gap-1">
            {TIERS.map((t, i) => (
              <span
                key={t.name}
                className={cn(
                  "flex-1 text-center text-[10px] font-medium uppercase tracking-wide",
                  i === tierIndex
                    ? "text-yellow-700 dark:text-accent"
                    : "text-neutral-400 dark:text-neutral-500"
                )}
              >
                {t.name}
              </span>
            ))}
          </div>
        </div>

        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Sezóna {season} · zatím {points} b. Tituly se počítají z bodů za celou sezónu, takže každý
          galavečer tě posune blíž.
        </p>
      </div>
    </Section>
  );
}
