import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { AddEventForm } from "@/components/admin/add-event-form";
import { PromoteUserButton } from "@/components/admin/promote-user-button";
import { BroadcastPushForm } from "@/components/admin/broadcast-push-form";
import { InviteCodeCard } from "@/components/admin/invite-code-card";
import { ViewModeToggle } from "@/components/admin/view-mode-toggle";
import { VIEW_MODE_COOKIE } from "@/lib/view-mode";

const STATUS_LABELS: Record<string, string> = {
  draft: "Návrh (skryté tipérům)",
  upcoming: "Chystá se",
  locked: "Uzamčeno",
  completed: "Vyhodnoceno",
};

// Push endpoint host -> platform label. iOS/iPadOS can only subscribe
// from an installed PWA, so an Apple endpoint doubles as an install signal.
function pushPlatform(endpoint: string): string {
  try {
    const host = new URL(endpoint).hostname;
    if (host.endsWith("push.apple.com")) return "iPhone/iPad";
    if (host.endsWith("googleapis.com")) return "Android/Chrome";
    if (host.endsWith("mozilla.com")) return "Firefox";
    if (host.endsWith("notify.windows.com")) return "Windows";
    return host;
  } catch {
    return "?";
  }
}

function formatSeen(iso: string): string {
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Europe/Prague",
  });
}

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

  const cookieStore = await cookies();
  const viewMode = cookieStore.get(VIEW_MODE_COOKIE)?.value === "admin" ? "admin" : "user";

  const { data: events } = await supabase
    .from("events")
    .select("id, number, name, event_date, status")
    .order("event_date", { ascending: false });

  const { data: profiles, error: profilesError } = isSuperadmin
    ? ((await supabase.rpc("admin_list_profiles")) as {
        data:
          | {
              id: string;
              nickname: string | null;
              is_admin: boolean;
              email: string | null;
              standalone_seen_at: string | null;
              push_endpoints: string[] | null;
            }[]
          | null;
        error: { message: string } | null;
      })
    : { data: null, error: null };

  return (
    <div className="flex flex-col gap-8 px-4 py-8">
      <h1 className="text-xl font-bold">Admin</h1>

      {isSuperadmin && <ViewModeToggle initialMode={viewMode} />}

      {isSuperadmin && <InviteCodeCard />}

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
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            📱 = spustil nainstalovanou appku (PWA) · 🔔 = má zapnutá push upozornění na daném zařízení
          </p>
          <div className="flex flex-col gap-2">
            {profiles?.map((p) => {
              const platforms = (p.push_endpoints ?? []).map(pushPlatform);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-3 shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60"
                >
                  <span className="flex min-w-0 flex-col">
                    <span>
                      {p.nickname ?? "Bez přezdívky"}
                      {p.is_admin && <span className="ml-2 text-xs font-semibold text-yellow-600 dark:text-[#FFD400]">ADMIN</span>}
                    </span>
                    <span className="truncate text-xs text-neutral-500 dark:text-neutral-400">{p.email}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {p.standalone_seen_at ? (
                        <span className="rounded-full bg-green-600/15 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400">
                          📱 PWA · {formatSeen(p.standalone_seen_at)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-neutral-500/10 px-2 py-0.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                          bez instalace
                        </span>
                      )}
                      {platforms.length > 0 ? (
                        platforms.map((platform, i) => (
                          <span
                            key={`${platform}-${i}`}
                            className="rounded-full bg-[#FFD400]/15 px-2 py-0.5 text-[11px] font-medium text-yellow-700 dark:text-[#FFD400]"
                          >
                            🔔 {platform}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full bg-neutral-500/10 px-2 py-0.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                          bez notifikací
                        </span>
                      )}
                    </span>
                  </span>
                  {p.id !== user.id && <PromoteUserButton targetUserId={p.id} isAdmin={p.is_admin} />}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
