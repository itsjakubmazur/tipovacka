"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function daysWord(n: number): string {
  if (n === 1) return "den";
  if (n >= 2 && n <= 4) return "dny";
  return "dní";
}

/** Badge + live countdown for a gala whose tipping is still open.
 *
 * The countdown never shows more than three boxes: the set switches to finer
 * units as the deadline approaches, so it can't grow wide enough to squeeze
 * the card's text on a narrow phone. Under an hour it turns red.
 *
 * Rendering starts with no countdown at all and it appears on mount - a
 * time-derived value rendered during SSR would disagree with what the browser
 * computes at hydration (React error #418). */
export function TippingStatus({
  lockAtIso,
  onImage,
}: {
  lockAtIso: string;
  onImage: boolean;
}) {
  const target = new Date(lockAtIso).getTime();
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(target - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  // Once the deadline passes we flip the badge ourselves, so the card doesn't
  // keep claiming tipping is open until the page is reloaded.
  const locked = remaining !== null && remaining <= 0;
  const showCountdown = remaining !== null && remaining > 0;

  let units: { value: string; label: string }[] = [];
  let urgent = false;
  if (showCountdown) {
    const totalSec = Math.floor(remaining / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    if (days >= 1) {
      units = [
        { value: String(days), label: daysWord(days) },
        { value: pad(hours), label: "hod" },
        { value: pad(minutes), label: "min" },
      ];
    } else if (remaining >= 3_600_000) {
      units = [
        { value: pad(hours), label: "hod" },
        { value: pad(minutes), label: "min" },
        { value: pad(seconds), label: "s" },
      ];
    } else {
      urgent = true;
      units = [
        { value: pad(minutes), label: "min" },
        { value: pad(seconds), label: "s" },
      ];
    }
  }

  return (
    <div className="relative z-10 flex shrink-0 flex-col items-end justify-between gap-2 self-stretch">
      <Badge variant={locked ? "secondary" : "accent"}>{locked ? "Uzamčeno" : "Otevřeno"}</Badge>

      {showCountdown && (
        <div className="flex gap-1 min-[420px]:gap-1.5">
          {units.map((u) => (
            <div
              key={u.label}
              className={cn(
                "min-w-[34px] rounded-md border px-[3px] py-[5px] text-center min-[420px]:min-w-[42px] min-[420px]:rounded-lg min-[420px]:px-1 min-[420px]:py-1.5",
                onImage
                  ? urgent
                    ? "border-red-400/35 bg-red-950/50 backdrop-blur-sm"
                    : "border-white/20 bg-black/45 backdrop-blur-sm"
                  : urgent
                    ? "border-red-600/30 bg-red-600/[0.07]"
                    : "border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.05]"
              )}
            >
              <div
                className={cn(
                  "text-[15px] font-bold leading-none tabular-nums min-[420px]:text-lg",
                  urgent
                    ? onImage
                      ? "text-red-400"
                      : "text-red-600 dark:text-red-400"
                    : onImage
                      ? "text-accent"
                      : "text-yellow-600 dark:text-accent"
                )}
              >
                {u.value}
              </div>
              <div
                className={cn(
                  "mt-[3px] text-[8px] uppercase tracking-wide min-[420px]:mt-1 min-[420px]:text-[9px]",
                  onImage ? "text-white/60" : "text-neutral-500 dark:text-neutral-400"
                )}
              >
                {u.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
