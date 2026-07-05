"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratedCardImage } from "@/components/leaderboard/generated-card-image";

/** The rendered result card (PNG straight from /share/card) with a
 * share button under it. Showing the image itself means it can be
 * long-pressed/right-clicked to save or copy; the button shares the
 * actual PNG file where supported (mobile share sheet), falling back
 * to sharing/copying the /share link with the card as OG preview. */
export function ShareResultCard({
  eventLabel,
  nickname,
  points,
  rank,
  total,
  imageUrl,
}: {
  eventLabel: string;
  nickname: string;
  points: number;
  rank: number | null;
  total: number | null;
  imageUrl?: string | null;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);

  const query = new URLSearchParams({
    event: eventLabel,
    nick: nickname,
    points: String(points),
  });
  if (rank != null) query.set("rank", String(rank));
  if (total != null) query.set("total", String(total));
  if (imageUrl) query.set("img", imageUrl);
  const cardUrl = `/share/card?${query.toString()}`;

  async function share() {
    const pageUrl = `${window.location.origin}/share?${query.toString()}`;
    const text = `${nickname}: ${points} b. na ${eventLabel}${rank ? ` (${rank}. místo)` : ""} 🥊`;

    // Prefer sharing the PNG itself - recipients get the picture, not a link.
    if (navigator.share) {
      try {
        const blob = await fetch(cardUrl).then((r) => (r.ok ? r.blob() : Promise.reject()));
        const file = new File([blob], "tipovacka-vysledek.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text });
          return;
        }
      } catch {
        // image fetch failed or file sharing unsupported - fall through
      }
      try {
        await navigator.share({ title: "OKTAGON GARÁŽ Tipovačka", text, url: pageUrl });
        return;
      } catch {
        // user closed the share sheet
        return;
      }
    }

    await navigator.clipboard.writeText(`${text} ${pageUrl}`);
    setFeedback("Odkaz zkopírován!");
    setTimeout(() => setFeedback(null), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      <GeneratedCardImage src={cardUrl} alt={`Výsledek: ${nickname}, ${points} b. na ${eventLabel}`} />
      <Button type="button" variant="accent" size="sm" onClick={share} className="self-start">
        <Share2 className="size-4" />
        {feedback ?? "Sdílet"}
      </Button>
    </div>
  );
}
