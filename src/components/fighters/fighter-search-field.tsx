"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

/** The search box. Types into the URL rather than into local state, so the
 * results are rendered on the server, a search can be shared as a link, and
 * the back button walks the queries you actually made.
 *
 * `replace`, not `push`: every keystroke would otherwise be its own history
 * entry and leaving the page would mean pressing back a dozen times. */
export function FighterSearchField({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  // The first render must not navigate: it would replace the URL the server
  // just rendered, for no change at all.
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current) return;
    const trimmed = value.trim();
    const timer = setTimeout(() => {
      startTransition(() => {
        router.replace(trimmed ? `${pathname}?q=${encodeURIComponent(trimmed)}` : pathname, {
          scroll: false,
        });
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [value, pathname, router]);

  return (
    <div className="relative">
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
      />
      <Input
        type="search"
        value={value}
        autoFocus
        // Nobody types diacritics into a phone, and the search does not need
        // them - but the keyboard should not fight the ones who do.
        autoComplete="off"
        spellCheck={false}
        aria-label="Jméno nebo přezdívka bojovníka"
        placeholder="Vémola, Pešta, T-800…"
        onChange={(e) => {
          typed.current = true;
          setValue(e.target.value);
        }}
        className="h-11 pl-9 pr-9"
      />
      {pending ? (
        <Loader2
          aria-hidden
          className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-neutral-400"
        />
      ) : (
        value.length > 0 && (
          <button
            type="button"
            aria-label="Vymazat hledání"
            onClick={() => {
              typed.current = true;
              setValue("");
            }}
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 outline-none transition-colors hover:text-black focus-visible:ring-2 focus-visible:ring-accent dark:hover:text-white"
          >
            <X className="size-4" />
          </button>
        )
      )}
    </div>
  );
}
