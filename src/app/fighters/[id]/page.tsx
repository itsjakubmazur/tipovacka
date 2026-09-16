import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getFighterProfile } from "@/lib/data/fighter-profile";
import { oktagonRecord } from "@/lib/fighter-history";
import { BackLink } from "@/components/ui/back-link";
import { FighterIdentity } from "@/components/fighters/fighter-identity";
import { FighterHistoryList } from "@/components/fighters/fighter-history-list";
import { CareerStatsPanel } from "@/components/fighters/career-stats";
import { SectionHeading } from "@/components/ui/section-heading";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await getFighterProfile(id);
  return { title: profile ? profile.fighter.name : "Bojovník" };
}

export default async function FighterPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const [{ data: userData }, { id }] = await Promise.all([supabase.auth.getUser(), params]);
  if (!userData.user) {
    redirect("/login");
  }

  const profile = await getFighterProfile(id);
  if (!profile || profile.fighter.is_tba) {
    notFound();
  }

  const { fighter, history, career } = profile;
  const record = oktagonRecord(history);
  const debut = history.length > 0 ? history[history.length - 1] : null;

  return (
    <div className="stagger-in flex flex-col gap-4 px-4 py-8">
      <BackLink href="/fighters">Najít bojovníka</BackLink>

      <FighterIdentity fighter={fighter} history={history} record={record} size="lg" />

      {fighter.bio && (
        <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {fighter.bio}
        </p>
      )}

      {career && (
        <section className="flex flex-col gap-2">
          <SectionHeading>Čísla ze zápasů</SectionHeading>
          <CareerStatsPanel career={career} />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionHeading>
          Zápasy v OKTAGONU
          {history.length > 0 && (
            <span className="text-sm font-normal tabular-nums text-neutral-500 dark:text-neutral-400">
              {history.length}
            </span>
          )}
        </SectionHeading>

        {/* Debut date rather than a count on its own: "od roku 2019" is what
            anyone actually means by "jak dlouho už tu je". */}
        {debut && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            V OKTAGONU od {new Date(debut.event_date).getFullYear()} · debut proti{" "}
            {debut.opponent_name} na {debut.event_label}
          </p>
        )}

        {history.length === 0 ? (
          <div className="glass-surface rounded-xl border p-6 text-center text-neutral-600 dark:text-neutral-400">
            Tady zatím nic — buď je to jeho premiéra v OKTAGONU, nebo se historie ještě nestihla
            natáhnout.
          </div>
        ) : (
          <FighterHistoryList history={history} linkOpponents />
        )}
      </section>
    </div>
  );
}
