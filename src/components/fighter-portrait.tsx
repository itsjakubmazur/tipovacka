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
  // Mobile Safari (notably inside the leaderboard's intercepted-route modal,
  // nested in an overflow-y-auto flex container) can fail to size a pure
  // `aspect-ratio` box that only contains an absolutely-positioned `fill`
  // image, collapsing it to zero height - the classic padding-bottom
  // intrinsic-ratio trick below doesn't depend on that computation and
  // works everywhere.
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
