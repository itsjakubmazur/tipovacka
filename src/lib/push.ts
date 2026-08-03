import { createClient } from "@/lib/supabase/client";
import { isIosLike, isStandaloneDisplay } from "@/lib/install-platform";

// Kept as named exports because push code reads better saying isIos(), but
// there is one implementation, in install-platform. Two copies drifted: this
// one missed iPadOS (which reports itself as a Mac) and the desktop
// window-controls-overlay display mode, so an iPad was told it could enable
// notifications in the browser, which it cannot.
export const isIos = isIosLike;
export const isStandalone = isStandaloneDisplay;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}

export async function subscribeToPush(
  userId: string
): Promise<{ success: true } | { success: false; error: string; denied?: boolean }> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    return { success: false, error: "Upozornění nejsou na tomto webu nastavená." };
  }

  // On iOS the permission prompt only appears if requestPermission() runs
  // directly inside the tap. Once it's been denied, iOS won't prompt again -
  // point people at Settings rather than showing the same failed button.
  if (typeof Notification !== "undefined" && Notification.permission === "denied") {
    return {
      success: false,
      denied: true,
      error:
        "Upozornění máš pro appku zakázaná. Zapni je v Nastavení iPhonu → Upozornění → OKTAGON GARÁŽ (nebo appku smaž z plochy a přidej znovu).",
    };
  }

  try {
    // Request permission FIRST, before any long await - iOS WebKit can drop
    // the user-gesture token across an awaited serviceWorker.register(),
    // which then silently returns "default".
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        success: false,
        denied: permission === "denied",
        error:
          permission === "denied"
            ? "Upozornění máš pro appku zakázaná. Zapni je v Nastavení iPhonu → Upozornění → OKTAGON GARÁŽ (nebo appku smaž z plochy a přidej znovu)."
            : "Klepni na Zapnout upozornění ještě jednou a dej Povolit.",
      };
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const keys = subscription.toJSON().keys;
    const supabase = createClient();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: keys?.p256dh ?? "",
        auth: keys?.auth ?? "",
      },
      { onConflict: "endpoint" }
    );
    if (error) throw error;

    return { success: true };
  } catch {
    return { success: false, error: "Povolení se nepodařilo nastavit." };
  }
}
