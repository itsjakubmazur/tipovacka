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
  grayedOut,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  grayedOut?: boolean;
  className?: string;
}) {
  // Inside the leaderboard's intercepted-route modal, iOS Safari collapses
  // this box to zero height whenever it has a `filter` (the old grayscale
  // class) applied - a known WebKit bug with `filter` breaking intrinsic
  // sizing in that nested context. A `mix-blend-mode: luminosity` overlay
  // gives the same black & white look without touching `filter` at all.
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
          {grayedOut && <div className="absolute inset-0 bg-white mix-blend-luminosity" />}
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
