import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddEventForm } from "@/components/admin/add-event-form";
import { PromoteUserButton } from "@/components/admin/promote-user-button";
import { BroadcastPushForm } from "@/components/admin/broadcast-push-form";

const STATUS_LABELS: Record<string, string> = {
  draft: "Návrh (skryté tipérům)",
  upcoming: "Chystá se",
  locked: "Uzamčeno",
  completed: "Vyhodnoceno",
};

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_superadmin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin && !profile?.is_superadmin) {
    redirect("/");
  }
  const isSuperadmin = profile?.is_superadmin ?? false;

  const { data: events } = await supabase
    .from("events")
    .select("id, number, name, event_date, status")
    .order("event_date", { ascending: false });

  const { data: profiles, error: profilesError } = isSuperadmin
    ? ((await supabase.rpc("admin_list_profiles")) as {
        data: { id: string; nickname: string | null; is_admin: boolean; email: string | null }[] | null;
        error: { message: string } | null;
      })
    : { data: null, error: null };

  return (
    <div className="flex flex-col gap-8 px-4 py-8">
      <h1 className="text-xl font-bold">Admin</h1>

      {isSuperadmin && (
        <Link href="/admin/scraper-log" className="self-start text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-black">
          Log scraperu →
        </Link>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Galavečery</h2>
        <div className="flex flex-col gap-2">
          {events?.map((event) => (
            <Link
              key={event.id}
              href={`/admin/events/${event.id}`}
              className="flex items-center justify-between rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-3 shadow-lg shadow-black/20 transition-shadow hover:shadow-xl hover:border-white/80 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60 dark:hover:border-neutral-500/80"
            >
              <span className="font-medium">
                {event.number ? `OKTAGON ${event.number}` : event.name}
              </span>
              <span className="text-sm text-neutral-500 dark:text-neutral-300">
                {STATUS_LABELS[event.status] ?? event.status}
              </span>
            </Link>
          ))}
        </div>
        <AddEventForm />
      </section>

      {isSuperadmin && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Poslat upozornění</h2>
          <BroadcastPushForm />
        </section>
      )}

      {isSuperadmin && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Uživatelé</h2>
          {profilesError && (
            <p className="text-sm text-red-600">Chyba při načítání uživatelů: {profilesError.message}</p>
          )}
          <div className="flex flex-col gap-2">
            {profiles?.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-3 shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60"
              >
                <span className="flex flex-col">
                  <span>
                    {p.nickname ?? "Bez přezdívky"}
                    {p.is_admin && <span className="ml-2 text-xs font-semibold text-[#FFD400]">ADMIN</span>}
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">{p.email}</span>
                </span>
                {p.id !== user.id && <PromoteUserButton targetUserId={p.id} isAdmin={p.is_admin} />}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
