"use client";

import { useEffect, useRef } from "react";
import { Emoji } from "emoji-mart";
import "@/lib/emoji-mart-init";

/** Renders a single emoji as an Apple-style image (emoji-mart's "apple"
 * sprite set, fetched from its default CDN) instead of plain unicode
 * text - Android's own emoji font is what this is working around, so
 * falling back to native rendering here would defeat the point. Falls
 * back to the raw character if the glyph isn't in emoji-mart's dataset
 * (e.g. an odd custom Unicode sequence). */
export function EmojiGlyph({ native, size = 18 }: { native: string; size?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = new Emoji({ native, set: "apple", size: `${size}px`, fallback: native });
    ref.current?.replaceChildren(el as unknown as Node);
  }, [native, size]);

  return <span ref={ref} className="inline-flex items-center justify-center align-middle" />;
}
