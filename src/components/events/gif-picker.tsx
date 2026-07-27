"use client";

import { useEffect, useRef, useState } from "react";
import { X, Search } from "lucide-react";

const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY;

/** Whether GIFs are available at all - the composer hides its GIF button
 * unless a Giphy key is configured. */
export const gifsEnabled = Boolean(GIPHY_KEY);

type GiphyGif = {
  id: string;
  images: {
    fixed_height: { url: string };
    downsized_medium: { url: string };
  };
};

/** Bottom-sheet Giphy picker. Searches as you type (debounced), shows
 * trending on open, and hands back the chosen GIF's URL. */
export function GifPicker({
  onSelect,
  onClose,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!GIPHY_KEY) return;
    const controller = new AbortController();
    const q = query.trim();
    const endpoint = q
      ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=pg-13&lang=cs`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=24&rating=pg-13`;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(endpoint, { signal: controller.signal });
        const json = await res.json();
        setGifs((json.data ?? []) as GiphyGif[]);
      } catch {
        // aborted or network error - leave the previous results
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-panel relative flex max-h-[70vh] flex-col overflow-hidden rounded-t-2xl border-t border-white/45 bg-white shadow-2xl shadow-black/40 dark:border-neutral-700/45 dark:bg-neutral-900"
      >
        <div className="flex shrink-0 items-center gap-2 px-3 py-2.5">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-neutral-300 bg-neutral-50 px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-800">
            <Search className="size-4 shrink-0 text-neutral-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hledat GIF…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zavřít"
            className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
          {gifs.length === 0 && !loading && (
            <p className="py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">
              Nic k zobrazení.
            </p>
          )}
          <div className="columns-2 gap-2 sm:columns-3">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => onSelect(gif.images.downsized_medium.url)}
                className="mb-2 block w-full overflow-hidden rounded-lg transition-opacity hover:opacity-80"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- animated remote GIF, next/image can't optimize it */}
                <img
                  src={gif.images.fixed_height.url}
                  alt=""
                  loading="lazy"
                  className="w-full"
                />
              </button>
            ))}
          </div>
        </div>

        <div className="shrink-0 py-1 text-center text-[10px] text-neutral-400 dark:text-neutral-600">
          POWERED BY GIPHY
        </div>
      </div>
    </div>
  );
}
