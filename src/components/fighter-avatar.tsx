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

const SIZE_PX = { sm: 40, md: 56, lg: 80 };

export function FighterAvatar({
  name,
  photoUrl,
  size = "md",
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "size-10 text-sm",
    md: "size-14 text-base",
    lg: "size-20 text-xl",
  }[size];

  if (photoUrl) {
    const px = SIZE_PX[size];
    return (
      <Image
        src={photoUrl}
        alt={name}
        width={px}
        height={px}
        className={cn(sizeClasses, "rounded-full object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClasses,
        "flex items-center justify-center rounded-full bg-neutral-200 font-semibold text-neutral-700 dark:text-neutral-300",
        className
      )}
    >
      {initials(name)}
    </div>
  );
}
