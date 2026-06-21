import Image from "next/image";
import { User } from "lucide-react";
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
  isTba,
  grayedOut,
  className,
}: {
  name: string;
  photoUrl?: string | null;
  isTba?: boolean;
  grayedOut?: boolean;
  className?: string;
}) {
  if (isTba) {
    return (
      <div className="relative w-full max-w-[180px] sm:max-w-[220px]">
        <div className="pb-[133.33%]" />
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center bg-neutral-200 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500",
            className
          )}
        >
          <User className="size-12" />
        </div>
      </div>
    );
  }

  // iOS Safari sometimes never paints this box on first render inside the
  // leaderboard modal - the photo is there (rotating the device "shakes it
  // loose") but doesn't composite until something forces a relayout.
  // Forcing the box onto its own GPU layer up front (translate3d) makes
  // Safari paint it immediately instead of lazily/never creating that
  // layer.
  if (photoUrl) {
    return (
      <div className="relative w-full max-w-[180px] sm:max-w-[220px] [transform:translate3d(0,0,0)]">
        <div className="pb-[133.33%]" />
        <div
          className={cn(
            "absolute inset-0 overflow-hidden bg-neutral-100 dark:bg-neutral-900",
            grayedOut && "grayscale",
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
