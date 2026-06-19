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
      <div className={cn("relative h-36 w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900 sm:h-48", className)}>
        <Image
          src={photoUrl}
          alt={name}
          fill
          sizes="(min-width: 640px) 240px, 45vw"
          className="object-cover object-top"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-36 w-full items-center justify-center bg-neutral-200 text-2xl font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 sm:h-48",
        className
      )}
    >
      {initials(name)}
    </div>
  );
}
