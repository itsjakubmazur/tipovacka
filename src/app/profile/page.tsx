import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NicknameForm } from "@/components/profile/nickname-form";
import { InstallAppGuide } from "@/components/profile/install-app-guide";
import { PushNotificationToggle } from "@/components/push/push-notification-toggle";
import { Badge } from "@/components/ui/badge";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, is_admin")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold">Profil</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{user.email}</p>
        {profile?.is_admin && <Badge variant="accent" className="mt-2">Admin</Badge>}
      </div>
      <NicknameForm userId={user.id} initialNickname={profile?.nickname ?? ""} />
      <InstallAppGuide />
      <PushNotificationToggle userId={user.id} />
    </div>
  );
}
