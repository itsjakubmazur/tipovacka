import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** The standard "← Zpět …" back link, with a real lucide arrow instead
 * of a bare glyph. Used above page headers across the app. */
export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-black dark:text-neutral-300 dark:hover:text-white",
        className
      )}
    >
      <ArrowLeft className="size-4" />
      {children}
    </Link>
  );
}
