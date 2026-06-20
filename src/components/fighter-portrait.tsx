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
  if (photoUrl) {
    return (
      <div
        className={cn(
          "relative aspect-[3/4] w-full max-w-[180px] overflow-hidden bg-neutral-100 dark:bg-neutral-900 sm:max-w-[220px]",
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
    );
  }

  return (
    <div
      className={cn(
        "flex aspect-[3/4] w-full max-w-[180px] items-center justify-center bg-neutral-200 text-2xl font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 sm:max-w-[220px]",
        className
      )}
    >
      {initials(name)}
    </div>
  );
}
