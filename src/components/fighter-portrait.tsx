import Image from "next/image";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function FighterPortrait({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  className?: string;
}) {
  // Inside the leaderboard's intercepted-route modal (nested overflow-y-auto
  // containers), iOS Safari/PWA's lazy-load viewport detection for `fill`
  // images can fail to ever trigger, so the photo never starts downloading
  // until something forces a relayout (e.g. rotating the device). `eager`
  // bypasses that detection entirely.
  if (photoUrl) {
    return (
      <div className="relative w-full max-w-[180px] sm:max-w-[220px]">
        <div className="pb-[133.33%]" />
        <div
          className={cn(
            "absolute inset-0 overflow-hidden bg-neutral-100 dark:bg-neutral-900",
            className
          )}
        >
          <Image
            src={photoUrl}
            alt={name}
            fill
            loading="eager"
            sizes="(min-width: 640px) 220px, 180px"
            className="object-cover object-top"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-[180px] sm:max-w-[220px]">
      <div className="pb-[133.33%]" />
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-neutral-200 text-2xl font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
          className
        )}
      >
        {initials(name)}
      </div>
    </div>
  );
}
