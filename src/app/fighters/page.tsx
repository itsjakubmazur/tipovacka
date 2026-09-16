import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { searchFighters, normalizeQuery } from "@/lib/data/fighter-profile";
import { PageHeading } from "@/components/ui/page-heading";
import { FighterSearchField } from "@/components/fighters/fighter-search-field";

export default async function FightersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const [{ data: userData }, { q }] = await Promise.all([supabase.auth.getUser(), searchParams]);
  if (!userData.user) {
    redirect("/login");
  }

  const query = (q ?? "").trim();
  const results = query ? await searchFighters(supabase, query) : [];
  // Two letters is where a substring search stops returning half the roster;
  // saying so beats an empty list that looks like "nobody by that name".
  const tooShort = query.length > 0 && normalizeQuery(query).length < 2;

  return (
    <div className="stagger-in flex flex-col gap-4 px-4 py-8">
      <PageHeading eyebrow="Archiv OKTAGONU">Najít bojovníka</PageHeading>

      <FighterSearchField initialQuery={query} />

      {!query && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Napiš jméno nebo přezdívku. Diakritika je jedno — „vemola“ najde Vémolu.
        </p>
      )}

      {tooShort && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Ještě aspoň jedno písmeno.
        </p>
      )}

      {query && !tooShort && results.length === 0 && (
        <div className="glass-surface rounded-xl border p-6 text-center text-neutral-600 dark:text-neutral-400">
          Nikoho takového nemáme. Zkus příjmení — a jestli v OKTAGONU nikdy nenastoupil, tak tu
          opravdu není.
        </div>
      )}

      {results.length > 0 && (
        <ul className="glass-surface divide-y divide-black/5 rounded-xl border dark:divide-white/5">
          {results.map((fighter) => (
            <li key={fighter.id}>
              <Link
                href={`/fighters/${fighter.id}`}
                className="flex items-center gap-3 px-3 py-2.5 outline-none transition-colors hover:bg-black/[0.03] focus-visible:bg-black/[0.03] dark:hover:bg-white/5 dark:focus-visible:bg-white/5"
              >
                <div className="relative size-11 shrink-0 overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
                  {(fighter.photo_url ?? fighter.fight_card_photo_url) && (
                    <Image
                      src={(fighter.photo_url ?? fighter.fight_card_photo_url)!}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover object-top"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold">
                    {fighter.flag_code && (
                      <Image
                        src={`https://flagcdn.com/h20/${fighter.flag_code}.png`}
                        alt={fighter.nationality ?? ""}
                        width={18}
                        height={13}
                        unoptimized
                        className="h-auto w-[18px] shrink-0"
                      />
                    )}
                    <span className="truncate">{fighter.name}</span>
                  </p>
                  {fighter.nickname && (
                    <p className="truncate text-xs italic text-neutral-500 dark:text-neutral-400">
                      {`„${fighter.nickname}“`}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right text-xs text-neutral-500 dark:text-neutral-400">
                  {fighter.fights > 0 && (
                    <p className="tabular-nums">
                      {fighter.fights} {fighter.fights === 1 ? "zápas" : fighter.fights <= 4 ? "zápasy" : "zápasů"}{" "}
                      v OKTAGONU
                    </p>
                  )}
                  {fighter.record && <p className="tabular-nums">Kariéra {fighter.record}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
