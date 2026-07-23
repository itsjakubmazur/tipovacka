"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { VIEW_MODE_COOKIE } from "@/lib/view-mode";

const REPO = "itsjakubmazur/tipovacka";

export async function setViewMode(mode: "user" | "admin") {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", userData.user.id)
    .single();
  if (!profile?.is_superadmin) return;

  const cookieStore = await cookies();
  cookieStore.set(VIEW_MODE_COOKIE, mode, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Distinct devices (push subscriptions) a broadcast would reach - shown in
 * the admin form so "send to everyone" isn't a blind action. */
export async function getBroadcastRecipientCount(): Promise<{ devices: number; people: number } | { error: string }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Nejsi přihlášený." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", userData.user.id)
    .single();
  if (!profile?.is_superadmin) return { error: "Nemáš oprávnění." };

  const { data: subs } = await supabase.from("push_subscriptions").select("user_id");
  const devices = subs?.length ?? 0;
  const people = new Set((subs ?? []).map((s) => s.user_id)).size;
  return { devices, people };
}

export async function triggerBroadcastPush(title: string, body: string, url: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: "Nejsi přihlášený." };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", userData.user.id)
    .single();
  if (!profile?.is_superadmin) {
    return { error: "Nemáš oprávnění." };
  }

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return { error: "GITHUB_DISPATCH_TOKEN není nastavený ve Vercel env proměnných." };
  }
  if (!title.trim() || !body.trim()) {
    return { error: "Vyplň název i text upozornění." };
  }

  const resp = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/broadcast-push.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: "main",
        inputs: { title, body, url: url.trim() || "/" },
      }),
    }
  );

  if (!resp.ok) {
    return { error: `GitHub Actions vrátil chybu (${resp.status}).` };
  }
  return { ok: true as const };
}
