"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratedCardImage } from "@/components/leaderboard/generated-card-image";

/** Share the top-3 podium of a finished gala as a PNG.
 *
 * The image is *not* rendered on the page. It costs a couple of seconds to
 * generate, occupies a 1200x630 block above the board, and says nothing the
 * standings right below it don't already say (medals and all) - its only real
 * job is being shared. Sharing fetches the PNG directly, so it never needed
 * to be on screen; where the native share sheet can't take a file, the image
 * is revealed instead so it can be saved by hand. */
export function PodiumCard({
  eventLabel,
  places,
  imageUrl,
}: {
  eventLabel: string;
  places: { rank: number; nick: string; points: number }[];
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
    <div className="flex flex-col gap-2">
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
