"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { subscribeToPush, isIos, isStandalone } from "@/lib/push";
import { Section } from "@/components/ui/section-heading";

export function PushNotificationToggle({ userId }: { userId: string }) {
  const supabase = createClient();

  const [supported] = useState(
    () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window
  );
  const [needsInstall] = useState(() => isIos() && !isStandalone());
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!supported || needsInstall) return;

    navigator.serviceWorker.register("/sw.js").then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      setSubscribed(!!existing);
    });
  }, [supported, needsInstall]);

  async function subscribe() {
    setLoading(true);
    setError(null);
    setDenied(false);
    const result = await subscribeToPush(userId);
    setLoading(false);
    if (result.success) {
      setSubscribed(true);
    } else {
      setError(result.error);
      setDenied(Boolean(result.denied));
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

  if (needsInstall) {
    return (
      <Section title="Upozornění na blížící se uzávěrku">
      <div className="glass-surface flex flex-col gap-2 rounded-xl border p-4">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Na iPhonu/iPadu fungují upozornění jen po instalaci na plochu - postupuj podle návodu výš a pak se vrať sem.
        </p>
      </div>
      </Section>
    );
  }

  return (
    <Section title="Upozornění na blížící se uzávěrku">
    <div className="glass-surface flex flex-col gap-2 rounded-xl border p-4">
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
      {error &&
        (denied ? (
          <p className="rounded-lg bg-amber-500/10 p-2.5 text-sm text-amber-700 dark:text-amber-300">
            {error}
          </p>
        ) : (
          <p className="text-sm text-red-600">{error}</p>
        ))}
    </div>
    </Section>
  );
}
