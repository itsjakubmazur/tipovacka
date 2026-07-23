import Link from "next/link";
import { Users, ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateGroupForm } from "@/components/groups/create-group-form";
import { JoinGroupForm } from "@/components/groups/join-group-form";

export default async function GroupsPage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/login");
  }

  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id, groups(id, name)")
    .eq("user_id", userData.user.id);

  const groups = (memberships ?? [])
    .map((m) => m.groups as unknown as { id: string; name: string } | null)
    .filter((g): g is { id: string; name: string } => g !== null);

  return (
    <div className="flex flex-col gap-4 px-4 py-8">
      <h1 className="text-xl font-bold">Skupiny</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Založ si privátní skupinu s kámoši a poměřte se jen mezi sebou.
      </p>

      <div className="flex flex-col gap-2">
        {groups.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 py-10 text-center dark:border-neutral-700">
            <span className="flex size-11 items-center justify-center rounded-full bg-accent/15 text-yellow-600 dark:text-accent">
              <Users className="size-5" />
            </span>
            <p className="font-medium">Zatím nejsi v žádné skupině</p>
            <p className="max-w-xs text-sm text-neutral-500 dark:text-neutral-400">
              Založ si vlastní partu, nebo se připoj přes zvací kód od kámoše — formuláře máš níže.
            </p>
          </div>
        )}
        {groups.map((group) => (
          <Link
            key={group.id}
            href={`/groups/${group.id}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/45 bg-white/35 p-3 shadow-lg shadow-black/20 backdrop-blur-lg transition hover:border-white/80 hover:shadow-xl dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60 dark:hover:border-neutral-500/80"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-yellow-600 dark:text-accent">
                <Users className="size-4" />
              </span>
              <span className="truncate font-semibold">{group.name}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-neutral-400" />
          </Link>
        ))}
      </div>

      <CreateGroupForm />
      <JoinGroupForm />
    </div>
  );
}
