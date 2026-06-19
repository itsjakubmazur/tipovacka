"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { subscribeToPush } from "@/lib/push";

const DISMISSED_KEY = "push-prompt-dismissed";

export function PushPromptBanner() {
  const [visible, setVisible] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      setUserId(data.user.id);
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

  async function enable() {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const result = await subscribeToPush(userId);
    setLoading(false);
    if (result.success) {
      dismiss();
    } else {
      setError(result.error);
    }
  }

  if (!visible) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FFD400] px-4 py-2 text-sm font-medium text-black">
      <button
        type="button"
        onClick={enable}
        disabled={loading}
        className="flex items-center gap-2 text-left disabled:opacity-70"
      >
        <Bell className="size-4 shrink-0" />
        {loading
          ? "Zapínám upozornění…"
          : "Ulož si web na plochu (iOS/Android) a zapni si upozornění na uzávěrky a novinky kolem karty!"}
      </button>
      <div className="flex items-center gap-3">
        {error && <span className="text-red-900">{error}</span>}
        <button type="button" onClick={dismiss} aria-label="Zavřít">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
