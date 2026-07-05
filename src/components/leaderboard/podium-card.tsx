"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Rendered top-3 podium PNG shown above the event leaderboard once the
 * gala is done, with a share button - same pattern as ShareResultCard. */
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

    await navigator.clipboard.writeText(text);
    setFeedback("Zkopírováno!");
    setTimeout(() => setFeedback(null), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cardUrl}
        alt={`Pódium ${eventLabel}`}
        width={1200}
        height={630}
        className="w-full rounded-xl border border-white/45 shadow-lg shadow-black/20 dark:border-neutral-700/45 dark:shadow-black/60"
      />
      <Button type="button" variant="outline" size="sm" onClick={share} className="self-start">
        <Share2 className="size-4" />
        {feedback ?? "Sdílet pódium"}
      </Button>
    </div>
  );
}
