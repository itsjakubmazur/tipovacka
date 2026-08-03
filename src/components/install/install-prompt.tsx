"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X, Share, MoreVertical, MonitorDown, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  detectInstallPlatform,
  installGuide,
  isStandaloneDisplay,
  type InstallGuide,
} from "@/lib/install-platform";

/** Deliberately sessionStorage, not localStorage: closing the card silences it
 * for this visit and no longer. Come back to the site and it asks again. */
const DISMISSED_KEY = "install-prompt-dismissed";
/** This one is localStorage and permanent - once the app is actually
 * installed there is nothing left to ask for. */
const INSTALLED_KEY = "install-prompt-installed";
/** The only thing standing between arriving and being asked to install: long
 * enough that the card lands after the page has settled rather than on top of
 * it loading. */
const DELAY_MS = 2500;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function PlatformIcon({ platform }: { platform: InstallGuide["platform"] }) {
  const className = "size-4 shrink-0";
  if (platform === "ios" || platform === "ios-other-browser" || platform === "macos-safari") {
    return <Share className={className} />;
  }
  if (platform === "android") return <MoreVertical className={className} />;
  return <MonitorDown className={className} />;
}

/** The nudge to install the app, floating over whatever you were reading.
 *
 * Two shapes depending on what the browser allows. Chromium fires
 * `beforeinstallprompt`, which we hold on to and fire from a real button - one
 * tap and it is installed. Everywhere else (all of iOS, Safari on the Mac)
 * there is no such API and the only honest thing is to describe the menu, so
 * the card shows the steps for that exact platform instead of a button that
 * cannot work. */
export function InstallPrompt() {
  const [guide, setGuide] = useState<InstallGuide | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  // false on the server and through hydration, true after - there is no
  // document to portal into until then
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Already installed: this is the app talking to itself.
    if (isStandaloneDisplay()) return;

    if (localStorage.getItem(INSTALLED_KEY)) return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    const platform = detectInstallPlatform();
    const found = installGuide(platform);
    if (!found) return;

    const timer = setTimeout(() => {
      setGuide(found);
      setVisible(true);
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Chromium fires this instead of showing its own bar; catching it is what
  // lets us offer a one-tap install at a moment of our choosing.
  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setVisible(false);
      localStorage.setItem(INSTALLED_KEY, "1");
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "accepted") setVisible(false);
    else dismiss();
  }

  if (!mounted || !guide) return null;

  return createPortal(
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3",
        // clears the bottom nav on a phone
        "pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-6"
      )}
    >
      <div
        role="dialog"
        aria-label="Přidat tipovačku na plochu"
        className={cn(
          "glass-panel w-full max-w-sm rounded-2xl border p-4 transition-all duration-500 ease-out motion-reduce:transition-none",
          visible
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "translate-y-6 opacity-0"
        )}
      >
        <div className="flex items-start gap-3">
          <Image
            src="/icon"
            alt=""
            width={44}
            height={44}
            unoptimized
            className="size-11 shrink-0 rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-tight">{guide.title}</p>
            <p className="mt-1 text-xs leading-snug text-neutral-600 dark:text-neutral-300">
              {guide.why}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Zavřít"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-black/[0.05] hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200"
          >
            <X className="size-4" />
          </button>
        </div>

        {deferred ? (
          <button
            type="button"
            onClick={install}
            className="glass-accent mt-3 flex w-full items-center justify-center gap-2 rounded-full border py-2 text-sm font-semibold"
          >
            <Download className="size-4" />
            Nainstalovat
          </button>
        ) : (
          <ol className="mt-3 flex flex-col gap-1.5 border-t border-black/5 pt-3 text-xs text-neutral-600 dark:border-white/10 dark:text-neutral-300">
            {guide.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-2">
                {i === 0 ? (
                  <PlatformIcon platform={guide.platform} />
                ) : (
                  <span className="w-4 shrink-0 text-center font-bold tabular-nums">
                    {i + 1}
                  </span>
                )}
                <span className="leading-snug">{step}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>,
    document.body
  );
}
