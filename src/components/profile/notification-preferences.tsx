"use client";

import { useState } from "react";
import { Check } from "lucide-react";
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
  {
    key: "notify_comments" as const,
    label: "Zprávy v kecárně",
    description: "Když ti někdo napíše do kecárny u galavečera (kromě tvých vlastních zpráv).",
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
  const [savedKey, setSavedKey] = useState<PrefKey | null>(null);

  async function toggle(key: PrefKey) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setError(null);
    setSavedKey(null);
    const { error } = await supabase
      .from("profiles")
      .update({ [key]: next[key] })
      .eq("id", userId);
    if (error) {
      setPrefs(prefs);
      setError("Uložení se nepodařilo, zkus to znovu.");
      return;
    }
    // Brief per-row confirmation so a silent optimistic toggle still reads
    // as "saved".
    setSavedKey(key);
    setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1800);
  }

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/45 bg-white/35 backdrop-blur-lg p-4 shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      <p className="mb-2 text-sm font-semibold">Jaká upozornění chceš dostávat</p>
      {PREFS.map((pref) => (
        <button
          key={pref.key}
          type="button"
          role="switch"
          aria-checked={prefs[pref.key]}
          aria-label={pref.label}
          onClick={() => toggle(pref.key)}
          className="flex min-h-11 w-full items-start gap-3 rounded-lg py-2 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
        >
          <span
            className={cn(
              "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
              prefs[pref.key] ? "bg-accent" : "bg-neutral-300 dark:bg-neutral-600"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                prefs[pref.key] ? "translate-x-[22px]" : "translate-x-0.5"
              )}
            />
          </span>
          <span className="flex flex-col">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {pref.label}
              {savedKey === pref.key && (
                <span className="flex items-center gap-0.5 text-xs font-normal text-green-600 dark:text-green-400">
                  <Check className="size-3.5" />
                  Uloženo
                </span>
              )}
            </span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{pref.description}</span>
          </span>
        </button>
      ))}
      <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
        Uzávěrka tipů, konečné výsledky galavečera a shrnutí den poté chodí vždy.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
