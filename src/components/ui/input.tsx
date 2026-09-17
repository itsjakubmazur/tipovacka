import * as React from "react";

import { cn } from "@/lib/utils";

/** 16px on a phone, 14px from `sm` up.
 *
 * Not a taste call: iOS Safari zooms the whole page in whenever you focus a
 * field whose text is under 16px, and then leaves you scrolled sideways.
 * The kecárna composer and the GIF picker already sidestep it with
 * `text-base`; this component did not, so every form built on it - hledání
 * bojovníka, přihlášení, přezdívka, číslo účtu - jumped on focus. Desktop
 * keeps the smaller size, where no such thing happens. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "glass-field flex h-10 w-full rounded-md border px-3 py-2 text-base sm:text-sm placeholder:text-neutral-400 outline-none focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Input };
