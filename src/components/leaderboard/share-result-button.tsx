"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareResultButton({
  eventLabel,
  nickname,
  points,
  rank,
  total,
}: {
  eventLabel: string;
  nickname: string;
  points: number;
  rank: number | null;
  total: number | null;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const query = new URLSearchParams({
      event: eventLabel,
      nick: nickname,
      points: String(points),
    });
    if (rank != null) query.set("rank", String(rank));
    if (total != null) query.set("total", String(total));
    const url = `${window.location.origin}/share?${query.toString()}`;
    const text = `${nickname}: ${points} b. na ${eventLabel}${rank ? ` (${rank}. místo)` : ""} 🥊`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "OKTAGON GARÁŽ Tipovačka", text, url });
        return;
      } catch {
        // user cancelled the sheet - nothing to do
        return;
      }
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={share} className="self-start">
      <Share2 className="size-4" />
      {copied ? "Odkaz zkopírován!" : "Sdílet výsledek"}
    </Button>
  );
}
