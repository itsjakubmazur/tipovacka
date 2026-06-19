"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { subscribeToPush } from "@/lib/push";

export function PushNotificationToggle({ userId }: { userId: string }) {
  const supabase = createClient();

  const [supported] = useState(
    () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;

    navigator.serviceWorker.register("/sw.js").then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      setSubscribed(!!existing);
    });
  }, [supported]);

  async function subscribe() {
    setLoading(true);
    setError(null);
    const result = await subscribeToPush(userId);
    setLoading(false);
    if (result.success) {
      setSubscribed(true);
    } else {
      setError(result.error);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      setError("Vypnutí se nepodařilo.");
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
      <p className="text-sm font-semibold">Upozornění na blížící se uzávěrku</p>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Dáme ti vědět, když se blíží uzávěrka a ještě nemáš dotipováno.
      </p>
      <Button
        type="button"
        variant={subscribed ? "outline" : "accent"}
        size="sm"
        disabled={loading}
        onClick={subscribed ? unsubscribe : subscribe}
        className="self-start"
      >
        {subscribed ? <BellOff className="size-4" /> : <Bell className="size-4" />}
        {loading ? "Ukládám…" : subscribed ? "Vypnout upozornění" : "Zapnout upozornění"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
