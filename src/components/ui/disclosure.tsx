"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

/** A summary row that opens its content with the app's standard reveal.
 *
 * Replaces `<details>` wherever the open/close should animate - a native
 * `<details>` snaps, and there's no way to transition it. */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
  summaryClassName,
  contentClassName,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  summaryClassName?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
          summaryClassName
        )}
      >
        {summary}
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-neutral-400 transition-transform duration-500 ease-out motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </button>
      <Reveal open={open}>
        <div className={contentClassName}>{children}</div>
      </Reveal>
    </div>
  );
}
