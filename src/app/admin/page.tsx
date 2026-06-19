import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddEventForm } from "@/components/admin/add-event-form";
import { PromoteUserButton } from "@/components/admin/promote-user-button";

export default async function AdminPage() {
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

  const { data: events } = await supabase
    .from("events")
    .select("id, number, name, event_date, status")
    .order("event_date", { ascending: false });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nickname, is_admin")
    .order("nickname", { ascending: true });

  return (
    <div className="flex flex-col gap-8 px-4 py-8">
      <h1 className="text-xl font-bold">Admin</h1>

      <Link href="/admin/scraper-log" className="self-start text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-black">
        Log scraperu →
      </Link>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Galavečery</h2>
        <div className="flex flex-col gap-2">
          {events?.map((event) => (
            <Link
              key={event.id}
              href={`/admin/events/${event.id}`}
              className="flex items-center justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 hover:border-neutral-400"
            >
              <span className="font-medium">
                {event.number ? `OKTAGON ${event.number}` : event.name}
              </span>
              <span className="text-sm text-neutral-500 dark:text-neutral-400">{event.status}</span>
            </Link>
          ))}
        </div>
        <AddEventForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Uživatelé</h2>
        <div className="flex flex-col gap-2">
          {profiles?.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 p-3"
            >
              <span>
                {p.nickname ?? "Bez přezdívky"}
                {p.is_admin && <span className="ml-2 text-xs font-semibold text-[#FFD400]">ADMIN</span>}
              </span>
              {p.id !== user.id && <PromoteUserButton targetUserId={p.id} isAdmin={p.is_admin} />}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
