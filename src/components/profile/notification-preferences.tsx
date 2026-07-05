"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const PREFS = [
  {
    key: "notify_fight_results" as const,
    label: "Výsledky jednotlivých zápasů",
    description: "Push po každém zápase s výsledkem a tvými body (během večera jich může přijít i tucet).",
  },
  {
    key: "notify_reminders" as const,
    label: "Připomínka před uzávěrkou",
    description: "Hodinu před zámkem tipů, s počtem zápasů, které ti zbývá dotipovat.",
  },
  {
    key: "notify_card_updates" as const,
    label: "Nová a změněná karta",
    description: "Když je zveřejněna karta nového galavečera nebo se na kartě něco změní.",
  },
];

type PrefKey = (typeof PREFS)[number]["key"];
export type NotificationPrefs = Record<PrefKey, boolean>;

export function NotificationPreferences({
  userId,
  initialPrefs,
}: {
  userId: string;
  initialPrefs: NotificationPrefs;
}) {
  const supabase = createClient();
  const [prefs, setPrefs] = useState(initialPrefs);
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: PrefKey) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setError(null);
    const { error } = await supabase
      .from("profiles")
      .update({ [key]: next[key] })
      .eq("id", userId);
    if (error) {
      setPrefs(prefs);
      setError("Uložení se nepodařilo, zkus to znovu.");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-4 shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      <p className="text-sm font-semibold">Jaká upozornění chceš dostávat</p>
      {PREFS.map((pref) => (
        <label key={pref.key} className="flex cursor-pointer items-start gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={prefs[pref.key]}
            onClick={() => toggle(pref.key)}
            className={cn(
              "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors",
              prefs[pref.key] ? "bg-[#FFD400]" : "bg-neutral-300 dark:bg-neutral-600"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
                prefs[pref.key] ? "translate-x-4.5" : "translate-x-0.5"
              )}
            />
          </button>
          <span className="flex flex-col">
            <span className="text-sm font-medium">{pref.label}</span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{pref.description}</span>
          </span>
        </label>
      ))}
      <p className="text-xs text-neutral-400 dark:text-neutral-500">
        Uzávěrka tipů, konečné výsledky galavečera a shrnutí den poté chodí vždy.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
