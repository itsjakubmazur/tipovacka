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
    <div className="stagger-in flex flex-col gap-4 px-4 py-8">
      <h1 className="text-xl font-bold lg:text-3xl">Skupiny</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Založ si privátní skupinu s kámoši a poměřte se jen mezi sebou.
      </p>

      <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3">
        {groups.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-black/15 py-10 text-center lg:col-span-2 dark:border-white/15">
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
            className="glass-surface glass-surface-interactive flex items-center justify-between gap-3 rounded-xl border p-3 transition"
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

      {/* the two forms are alternatives to each other, so side by side on a
          wide screen reads better than one under the other */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <CreateGroupForm />
        <JoinGroupForm />
      </div>
    </div>
  );
}
