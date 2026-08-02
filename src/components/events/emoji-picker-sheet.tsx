"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Picker } from "emoji-mart";
// see emoji-mart-init.ts for why this is the "apple" set specifically,
// not the package's default "native" one
import data from "@emoji-mart/data/sets/15/apple.json";
import { emojiImageUrl, emojiSpritesheetUrl } from "@/lib/emoji-mart-init";
import { X } from "lucide-react";

/** Full emoji-mart picker (categories + search + skin tones), rendered
 * as its own slide-up sheet above the kecárna panel - a plain text
 * field let people type whatever, which isn't what a reaction is for.
 * "apple" set keeps the glyphs looking the same (nice) regardless of
 * whether the viewer is on Android, iOS, or desktop. */
export function EmojiPickerSheet({
  onSelect,
  onClose,
}: {
  onSelect: (native: string) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const container = containerRef.current;
    const picker = new Picker({
      data,
      set: "apple",
      theme: resolvedTheme === "dark" ? "dark" : "light",
      previewPosition: "none",
      skinTonePosition: "search",
      getImageURL: emojiImageUrl,
      getSpritesheetURL: emojiSpritesheetUrl,
      onEmojiSelect: (emoji: { native: string }) => onSelect(emoji.native),
    });
    container?.replaceChildren(picker as unknown as Node);
    return () => {
      container?.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- picker is rebuilt only when the theme actually changes
  }, [resolvedTheme]);

  return (
    <div
      // centred dialog from lg, bottom sheet below - emoji-mart's grid is a
      // fixed width, so a full-viewport sheet just left it stranded in space
      className="fixed inset-0 z-[60] flex flex-col justify-end lg:items-center lg:justify-center lg:p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel border relative flex max-h-[75vh] flex-col rounded-t-2xl border-t lg:w-full lg:max-w-sm lg:rounded-2xl lg:border"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <p className="text-sm font-semibold">Vyber reakci</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít"
            className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <X className="size-4" />
          </button>
        </div>
        <div ref={containerRef} className="flex justify-center overflow-y-auto p-2" />
      </div>
    </div>
  );
}
