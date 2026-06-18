import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

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
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className={cn(sizeClasses, "rounded-full object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClasses,
        "flex items-center justify-center rounded-full bg-neutral-200 font-semibold text-neutral-700",
        className
      )}
    >
      {initials(name)}
    </div>
  );
}
