import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChartNoAxesColumn, ArrowRight, BookOpen, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NicknameForm } from "@/components/profile/nickname-form";
import { BankAccountForm } from "@/components/profile/bank-account-form";
import { StartovneStats } from "@/components/profile/startovne-stats";
import { NemesisCard } from "@/components/profile/nemesis-card";
import { InstallAppGuide } from "@/components/profile/install-app-guide";
import { NotificationPreferences } from "@/components/profile/notification-preferences";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { PushNotificationToggle } from "@/components/push/push-notification-toggle";
import { Badge } from "@/components/ui/badge";
import { TipperPathCard } from "@/components/profile/tipper-path-card";
import { PageHeading } from "@/components/ui/page-heading";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: bankRow }] = await Promise.all([
    supabase
      .from("profiles")
      .select("nickname, is_admin, notify_fight_results, notify_reminders, notify_card_updates, notify_comments")
      .eq("id", user.id)
      .single(),
    supabase.from("profile_bank_accounts").select("bank_account").eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <div className="stagger-in flex flex-col gap-6 px-4 py-8">
      <div>
        <PageHeading eyebrow={profile?.nickname ?? user.email}>Profil</PageHeading>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{user.email}</p>
        {profile?.is_admin && <Badge variant="accent" className="mt-2">Admin</Badge>}
      </div>
      {/* From lg the page splits into "who you are" and "how the app behaves" -
          the two halves are contiguous, so on a phone they simply stack in the
          order they always did. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="stagger-in flex flex-col gap-6">
          <TipperPathCard userId={user.id} />
          <NicknameForm userId={user.id} initialNickname={profile?.nickname ?? ""} />
          <BankAccountForm userId={user.id} initialAccount={bankRow?.bank_account ?? ""} />
          <Suspense fallback={<div className="glass-surface h-24 animate-pulse rounded-xl border" />}>
            <StartovneStats userId={user.id} />
          </Suspense>
          <Suspense fallback={<div className="glass-surface h-24 animate-pulse rounded-xl border" />}>
            <NemesisCard userId={user.id} />
          </Suspense>
          <Link
            href="/groups"
            className="glass-surface glass-surface-interactive flex items-center gap-2 rounded-xl border p-4 text-sm font-semibold transition"
          >
            <Users className="size-4 text-yellow-600 dark:text-accent" />
            Mini-ligy a skupiny
            <ArrowRight className="ml-auto size-4 text-neutral-400" />
          </Link>
          <Link
            href={`/leaderboard/u/${user.id}`}
            className="glass-surface glass-surface-interactive flex items-center gap-2 rounded-xl border p-4 text-sm font-semibold transition"
          >
            <ChartNoAxesColumn className="size-4 text-yellow-600 dark:text-accent" />
            Moje statistiky a odznaky
            <ArrowRight className="ml-auto size-4 text-neutral-400" />
          </Link>
          <Link
            href="/pravidla"
            className="glass-surface glass-surface-interactive flex items-center gap-2 rounded-xl border p-4 text-sm font-semibold transition"
          >
            <BookOpen className="size-4 text-yellow-600 dark:text-accent" />
            Jak se hraje — pravidla a body
            <ArrowRight className="ml-auto size-4 text-neutral-400" />
          </Link>
        </div>

        <div className="stagger-in flex flex-col gap-6">
          <ChangePasswordForm />
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
      </div>
    </div>
  );
}
