"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const DISMISSED_KEY = "push-prompt-dismissed";

export function PushPromptBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (Notification.permission !== "default") return;

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;

      const registration = await navigator.serviceWorker.getRegistration();
      const existing = await registration?.pushManager.getSubscription();
      if (existing || cancelled) return;

      setVisible(true);
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
    <div className="flex items-center justify-between gap-3 bg-[#FFD400] px-4 py-2 text-sm font-medium text-black">
      <span className="flex items-center gap-2">
        <Bell className="size-4 shrink-0" />
        Zapni si upozornění na uzávěrky a novinky kolem karty.
      </span>
      <div className="flex items-center gap-3">
        <Link href="/profile" className="whitespace-nowrap underline">
          Zapnout
        </Link>
        <button type="button" onClick={dismiss} aria-label="Zavřít">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
