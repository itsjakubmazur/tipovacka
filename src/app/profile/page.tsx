import Link from "next/link";
import { redirect } from "next/navigation";
import { ChartNoAxesColumn, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NicknameForm } from "@/components/profile/nickname-form";
import { BankAccountForm } from "@/components/profile/bank-account-form";
import { StartovneStats } from "@/components/profile/startovne-stats";
import { InstallAppGuide } from "@/components/profile/install-app-guide";
import { NotificationPreferences } from "@/components/profile/notification-preferences";
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
    .select(
      "nickname, is_admin, notify_fight_results, notify_reminders, notify_card_updates, notify_comments, bank_account"
    )
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
      <BankAccountForm userId={user.id} initialAccount={profile?.bank_account ?? ""} />
      <StartovneStats userId={user.id} />
      <Link
        href={`/leaderboard/u/${user.id}`}
        className="flex items-center gap-2 rounded-xl border border-white/45 bg-white/35 p-4 text-sm font-semibold shadow-lg shadow-black/20 backdrop-blur-lg transition hover:border-white/80 hover:shadow-xl dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60 dark:hover:border-neutral-500/80"
      >
        <ChartNoAxesColumn className="size-4 text-yellow-600 dark:text-accent" />
        Moje statistiky a odznaky
        <ArrowRight className="ml-auto size-4 text-neutral-400" />
      </Link>
      <InstallAppGuide />
      <PushNotificationToggle userId={user.id} />
      <NotificationPreferences
        userId={user.id}
        initialPrefs={{
          notify_fight_results: profile?.notify_fight_results ?? true,
          notify_reminders: profile?.notify_reminders ?? true,
          notify_card_updates: profile?.notify_card_updates ?? true,
          notify_comments: profile?.notify_comments ?? true,
        }}
      />
    </div>
  );
}
