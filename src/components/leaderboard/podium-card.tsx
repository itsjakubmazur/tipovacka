"use client";

import Link from "next/link";
import { useState } from "react";
import { Share2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratedCardImage } from "@/components/leaderboard/generated-card-image";
import { cn } from "@/lib/utils";

type Place = { rank: number; userId: string; nick: string; points: number };

// classic podium arrangement: runner-up left, winner centre, third right
const PODIUM_ORDER = [2, 1, 3];

const BLOCK = {
  1: "glass-accent h-16",
  2: "glass-surface h-12 border",
  3: "glass-surface h-9 border",
} as const;

/** The top three of a finished gala, as an actual podium.
 *
 * Drawn in plain markup rather than the shareable PNG: the picture cost a
 * couple of seconds and a 1200x630 block on every visit, and three names in a
 * row is what the standings underneath already give you. A podium *shape*
 * reads as a ceremony instead of more data - and costs nothing to draw.
 *
 * The PNG still exists purely to be shared, and is generated on demand: the
 * share call fetches it itself, so it never needs to be on screen. Where the
 * native share sheet can't carry a file, it's revealed to be saved by hand. */
export function PodiumCard({
  eventLabel,
  places,
  eventId,
  imageUrl,
}: {
  eventLabel: string;
  places: Place[];
  eventId: string;
  imageUrl?: string | null;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [sharing, setSharing] = useState(false);

  const query = new URLSearchParams({ event: eventLabel });
  for (const place of places) {
    query.set(`n${place.rank}`, place.nick);
    query.set(`p${place.rank}`, String(place.points));
  }
  if (imageUrl) query.set("img", imageUrl);
  const cardUrl = `/share/podium?${query.toString()}`;

  const byRank = new Map(places.map((p) => [p.rank, p]));

  async function share() {
    const text = `Nejlepší tipeři na ${eventLabel}: ${places
      .map((p) => `${p.rank}. ${p.nick} (${p.points} b.)`)
      .join(", ")}`;

    setSharing(true);
    try {
      if (navigator.share) {
        try {
          const blob = await fetch(cardUrl).then((r) => (r.ok ? r.blob() : Promise.reject()));
          const file = new File([blob], "tipovacka-podium.png", { type: "image/png" });
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], text });
            return;
          }
        } catch {
          // image fetch failed or file sharing unsupported - fall through
        }
        try {
          await navigator.share({ title: "OKTAGON GARÁŽ Tipovačka", text, url: window.location.href });
          return;
        } catch {
          return;
        }
      }

      // No share sheet to hand it to - put the picture on screen so it can be
      // saved or copied, and take the text to the clipboard.
      setRevealed(true);
      await navigator.clipboard.writeText(text);
      setFeedback("Text zkopírován");
      setTimeout(() => setFeedback(null), 2000);
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="glass-surface flex flex-col gap-3 rounded-xl border p-4">
      <div className="mx-auto flex w-full max-w-xs items-end gap-2">
        {PODIUM_ORDER.map((rank) => {
          const place = byRank.get(rank);
          if (!place) return null;
          // Staggered by placing, not by position on screen: the winner's step
          // arrives first, then second, then third. (Keying off the DOM index
          // would follow the 2-1-3 layout order instead.)
          const delay = `${(rank - 1) * 260}ms`;
          return (
            <Link
              key={rank}
              style={{ animationDelay: delay }}
              href={`/leaderboard/u/${place.userId}?eventId=${eventId}`}
              // the podium shouldn't be a dead end - "how did the winner
              // actually tip?" is the thing you want next
              className="animate-podium-step flex min-w-0 flex-1 flex-col items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {rank === 1 && <Crown className="size-4 shrink-0 text-yellow-600 dark:text-accent" />}
              <span className="w-full truncate text-center text-xs font-semibold underline-offset-2 hover:underline" title={place.nick}>
                {place.nick}
              </span>
              <div
                style={{ animationDelay: delay }}
                className={cn(
                  "animate-podium-rise flex w-full flex-col items-center justify-center rounded-t-lg",
                  BLOCK[rank as 1 | 2 | 3]
                )}
              >
                <span className="text-base font-bold leading-none tabular-nums">{place.points}</span>
                <span className="mt-0.5 text-[10px] font-semibold opacity-70">{rank}.</span>
              </div>
            </Link>
          );
        })}
      </div>

      {revealed && <GeneratedCardImage src={cardUrl} alt={`Pódium ${eventLabel}`} />}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={sharing}
        onClick={share}
        className="self-start"
      >
        <Share2 className="size-4" />
        {feedback ?? (sharing ? "Připravuji…" : "Sdílet pódium")}
      </Button>
    </div>
  );
}
