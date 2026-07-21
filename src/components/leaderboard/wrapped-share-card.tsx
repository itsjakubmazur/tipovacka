"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratedCardImage } from "@/components/leaderboard/generated-card-image";

/** Rendered season-recap PNG (from /share/wrapped) with a share
 * button - same flow as ShareResultCard: prefer sharing the PNG file
 * itself, fall back to link + clipboard. */
export function WrappedShareCard({
  season,
  nickname,
  points,
  rank,
  total,
  wins,
  best,
  balance,
}: {
  season: number;
  nickname: string;
  points: number;
  rank: number | null;
  total: number | null;
  wins: number;
  best: string | null;
  balance: number | null;
}) {
  const [feedback, setFeedback] = useState<string | null>(null);

  const query = new URLSearchParams({
    season: String(season),
    nick: nickname,
    points: String(points),
  });
  if (rank != null) query.set("rank", String(rank));
  if (total != null) query.set("total", String(total));
  if (wins > 0) query.set("wins", String(wins));
  if (best) query.set("best", best);
  if (balance != null) query.set("balance", String(balance));
  const cardUrl = `/share/wrapped?${query.toString()}`;

  async function share() {
    const text = `${nickname}: sezóna ${season} v tipovačce — ${points} b.${rank ? `, ${rank}. místo` : ""}`;

    if (navigator.share) {
      try {
        const blob = await fetch(cardUrl).then((r) => (r.ok ? r.blob() : Promise.reject()));
        const file = new File([blob], `tipovacka-sezona-${season}.png`, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text });
          return;
        }
      } catch {
        // fall through to plain share
      }
      try {
        await navigator.share({ title: "OKTAGON GARÁŽ Tipovačka", text });
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
      <GeneratedCardImage src={cardUrl} alt={`Sezóna ${season}: ${nickname}, ${points} b.`} />
      <Button type="button" variant="accent" size="sm" onClick={share} className="self-start">
        <Share2 className="size-4" />
        {feedback ?? "Sdílet"}
      </Button>
    </div>
  );
}
