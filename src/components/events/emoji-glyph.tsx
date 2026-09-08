"use client";

import { useEffect, useState } from "react";
import { emojiReady, emojiSpriteStyle } from "@/lib/emoji-mart-init";

/** Renders a single emoji as an Apple-style image (self-hosted, see
 * emoji-mart-init.ts) instead of plain unicode text - Android's own
 * emoji font is what this is working around, so falling back to native
 * rendering here would defeat the point. Falls back to the raw
 * character if the glyph isn't in emoji-mart's dataset (e.g. an odd
 * custom Unicode sequence).
 *
 * Drawn from the spritesheet rather than a per-emoji <img>: one 4 MB
 * file the browser caches once, instead of 3 667 individual PNGs. */
export function EmojiGlyph({ native, size = 18 }: { native: string; size?: number }) {
  // Sync on every render after the dataset has loaded, so a thread full
  // of reactions paints its glyphs immediately rather than flashing the
  // system font for a tick.
  const [style, setStyle] = useState(() => emojiSpriteStyle(native, size));

  useEffect(() => {
    let cancelled = false;
    void emojiReady.then(() => {
      if (!cancelled) setStyle(emojiSpriteStyle(native, size));
    });
    return () => {
      cancelled = true;
    };
  }, [native, size]);

  if (!style) {
    return (
      <span
        className="inline-flex items-center justify-center align-middle"
        style={{ fontSize: size, lineHeight: 1 }}
      >
        {native}
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={native}
      className="inline-flex shrink-0 items-center justify-center align-middle"
      style={style}
    />
  );
}
