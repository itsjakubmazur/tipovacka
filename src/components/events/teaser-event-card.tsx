"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarClock, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/** A dimmed, locked "coming soon" card for the next gala, shown to
 * tippers ~10 days before it starts — before its card opens for tipping
 * (3 days before, 9:00 Prague). Not a link: there's nothing to open
 * yet. A live countdown ticks down to the moment tipping opens, which
 * is the same instant the card flips to a normal, tappable event. */
export function TeaserEventCard({
  title,
  subtitle,
  location,
  eventDateIso,
  openAtIso,
  imageUrl,
  href,
}: {
  title: string;
  subtitle?: string | null;
  location: string | null;
  eventDateIso: string;
  openAtIso: string;
  imageUrl: string | null;
  /** Admins browsing in admin view get the same card everyone else sees, but
   * tappable - they can already open a draft's detail. */
  href?: string;
}) {
  const target = new Date(openAtIso).getTime();
  // Deliberately null on the first render. A countdown computed during SSR is
  // already stale by the time the browser hydrates (a minute can tick over in
  // between), and React reports that text difference as a hydration error
  // (#418). We render placeholders until mount, then tick.
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(target - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  const totalSec = remaining === null ? null : Math.max(0, Math.floor(remaining / 1000));
  const days = totalSec === null ? null : Math.floor(totalSec / 86400);
  const hours = totalSec === null ? null : Math.floor((totalSec % 86400) / 3600);
  const minutes = totalSec === null ? null : Math.floor((totalSec % 3600) / 60);
  const units = [
    { value: days, label: days === 1 ? "den" : "dní" },
    { value: hours, label: "hod" },
    { value: minutes, label: "min" },
  ];

  const opensLabel = new Date(openAtIso)
    .toLocaleDateString("cs-CZ", {
      weekday: "short",
      day: "numeric",
      month: "numeric",
      timeZone: "Europe/Prague",
    })
    .replace(",", "");

  // The dashed outline is the card's signature, so it has to read in both
  // themes. Light mode can't use the accent: the page sits at #f1f1f2 under a
  // 34% yellow glow, so #ffd400 lands on near-identical hue *and* lightness
  // and vanishes. Same fix the app uses elsewhere - a darker gold for light,
  // the raw accent for dark (cf. text-yellow-600 dark:text-accent).
  const shell = cn(
    "relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-xl border border-dashed border-yellow-600/70 bg-gradient-to-br from-accent/[0.06] to-white/[0.02] p-4 dark:border-accent/35",
    href && "transition-colors hover:border-yellow-700 dark:hover:border-accent/70"
  );
  const content = (
    <>
      {imageUrl && (
        <>
          <Image src={imageUrl} alt="" fill className="object-cover opacity-40 blur-[2px] grayscale" />
          <div className="absolute inset-0 bg-background/70" />
        </>
      )}

      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="font-semibold text-black dark:text-white">{title}</p>
          {subtitle && <p className="text-sm font-medium text-yellow-600 dark:text-accent">{subtitle}</p>}
          {location && <p className="text-sm text-neutral-500 dark:text-neutral-400">{location}</p>}
          <p className="text-sm text-neutral-400 dark:text-neutral-500">
            {new Date(eventDateIso).toLocaleString("cs-CZ", {
              dateStyle: "long",
              timeStyle: "short",
              timeZone: "Europe/Prague",
            })}
          </p>
        </div>
        <span className="glass-pill inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium text-neutral-500 dark:text-neutral-300">
          <Lock className="size-3" />
          Brzy
        </span>
      </div>

      <div className="relative z-10 mt-4 flex items-center justify-between gap-3 border-t border-black/10 pt-3 dark:border-white/10">
        <p className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <CalendarClock className="size-4 shrink-0 text-yellow-600 dark:text-accent" />
          <span>
            Tipování se otevře
            <br />
            <span className="font-semibold text-black dark:text-white">{opensLabel} v 9:00</span>
          </span>
        </p>
        <div className="flex shrink-0 gap-1.5">
          {units.map((u, i) => (
            <div
              key={i}
              className="min-w-[42px] overflow-hidden rounded-lg border border-black/10 bg-black/[0.03] px-1 py-1.5 text-center dark:border-white/10 dark:bg-white/[0.05]"
            >
              {/* keyed by the value so only the unit that changed rolls over */}
              <div
                key={u.value ?? "-"}
                className="animate-digit-roll text-lg font-bold leading-none tabular-nums text-yellow-600 dark:text-accent"
              >
                {u.value ?? "–"}
              </div>
              <div className="mt-1 text-[9px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {u.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return href ? (
    <Link href={href} className={shell}>
      {content}
    </Link>
  ) : (
    <div className={shell}>{content}</div>
  );
}
