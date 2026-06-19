import Link from "next/link";
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
      <p className="text-sm text-neutral-600">
        Založ si privátní skupinu s kámoši a poměřte se jen mezi sebou.
      </p>

      <div className="flex flex-col gap-2">
        {groups.length === 0 && (
          <p className="text-neutral-600">Zatím nejsi v žádné skupině.</p>
        )}
        {groups.map((group) => (
          <Link
            key={group.id}
            href={`/groups/${group.id}`}
            className="flex items-center justify-between rounded-xl border border-neutral-200 p-3 hover:border-neutral-400"
          >
            <span className="font-semibold">{group.name}</span>
          </Link>
        ))}
      </div>

      <CreateGroupForm />
      <JoinGroupForm />
    </div>
  );
}
