import { BackLink } from "@/components/ui/back-link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  });
}

/** Superadmin-only list of uncaught browser errors reported by
 * ErrorReporter - the whole self-hosted "Sentry" this app needs. */
export default async function ClientErrorsPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_superadmin) {
    redirect("/");
  }

  const { data: errors } = await supabase
    .from("client_errors")
    .select("id, message, stack, url, user_agent, created_at, profiles(nickname)")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (errors ?? []) as unknown as {
    id: string;
    message: string;
    stack: string | null;
    url: string | null;
    user_agent: string | null;
    created_at: string;
    profiles: { nickname: string } | null;
  }[];

  return (
    <div className="flex flex-col gap-4 px-4 py-8">
      <div>
        <BackLink href="/admin">Zpět do adminu</BackLink>
        <h1 className="mt-1 text-xl font-bold">Chyby v prohlížečích</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Neodchycené chyby z appky tipérů, posledních 100.
        </p>
      </div>

      {rows.length === 0 && (
        <p className="text-neutral-600 dark:text-neutral-400">Žádné chyby. Tak to má být.</p>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <details
            key={row.id}
            className="rounded-xl border border-white/45 bg-white/35 p-3 text-sm shadow-lg shadow-black/20 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60"
          >
            <summary className="cursor-pointer select-none">
              <span className="font-medium text-red-700 dark:text-red-400">{row.message}</span>
              <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                {formatTime(row.created_at)} · {row.profiles?.nickname ?? "?"} · {row.url}
              </span>
            </summary>
            {row.stack && (
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-xs text-neutral-600 dark:text-neutral-400">
                {row.stack}
              </pre>
            )}
            {row.user_agent && (
              <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">{row.user_agent}</p>
            )}
          </details>
        ))}
      </div>
    </div>
  );
}
