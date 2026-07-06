"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const DISMISSED_KEY = "bank-account-prompt-dismissed";

/** Nudges anyone without a bank account set to add one - relevant to
 * everyone since anyone could win a future startovné pool. Dismissal
 * is permanent (same pattern as PushPromptBanner); the moment it
 * actually matters (you just won a pool with no account), the scraper
 * sends a direct push instead of relying on this banner. */
export function BankAccountPromptBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user || cancelled) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("bank_account")
        .eq("id", userData.user.id)
        .single();
      if (cancelled) return;

      if (!profile?.bank_account) setVisible(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-800">
      <Link href="/profile" className="flex items-center gap-2 text-left" onClick={dismiss}>
        <Wallet className="size-4 shrink-0 text-[#FFD400]" />
        Nastav si číslo účtu v profilu, ať můžeš vybírat výhry ze startovného.
      </Link>
      <button type="button" onClick={dismiss} aria-label="Zavřít">
        <X className="size-4" />
      </button>
    </div>
  );
}
