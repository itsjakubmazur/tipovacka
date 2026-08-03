"use client";

import { useSyncExternalStore } from "react";
import { Smartphone } from "lucide-react";
import { Section } from "@/components/ui/section-heading";
import {
  detectInstallPlatform,
  installGuide,
  isStandaloneDisplay,
} from "@/lib/install-platform";

/** The permanent copy of the install instructions.
 *
 * The floating nudge can be dismissed and then stays away for two months; this
 * is where someone goes when they change their mind, or when they open the
 * site on a second device. Both read the same platform detection, so they can
 * no longer describe two different menus for the same phone. */
export function InstallAppGuide() {
  // Nothing to detect until we are in a browser, and rendering one platform's
  // steps for a frame before swapping to another's is worse than rendering
  // nothing.
  const client = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  if (!client) return null;
  if (isStandaloneDisplay()) return null;

  const guide = installGuide(detectInstallPlatform());
  if (!guide) return null;

  return (
    <Section
      title={guide.title}
      icon={<Smartphone className="size-4" />}
    >
      <div className="glass-accent-soft flex flex-col gap-2 rounded-xl border p-4">
        <p className="text-sm text-neutral-700 dark:text-neutral-300">{guide.why}</p>
        <ol className="list-decimal pl-5 text-sm text-neutral-700 dark:text-neutral-300">
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
