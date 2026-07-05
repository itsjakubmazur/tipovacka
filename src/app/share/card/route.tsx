import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import {
  CardBackdrop,
  MEDAL_COLORS,
  MedalIcon,
  fetchImageDataUri,
  loadCzechFont,
  pointsWord,
  safeImageUrl,
} from "@/lib/og-card";

export const runtime = "edge";

// Renders the shareable result card as a PNG. Param values come from the
// share link itself (friends-app trust model - no signing).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const event = params.get("event") ?? "OKTAGON";
  const nick = params.get("nick") ?? "Tipér";
  const points = params.get("points") ?? "0";
  const rank = params.get("rank");
  const total = params.get("total");
  const rawImageUrl = safeImageUrl(params.get("img"));
  const imageUrl = rawImageUrl ? await fetchImageDataUri(rawImageUrl) : null;

  const rankLabel = rank ? `${rank}. místo${total ? ` z ${total}` : ""}` : null;
  const footer = `TIPNI SI TAKY · ${request.nextUrl.host.toUpperCase()}`;
  const allText = `OKTAGON GARÁŽ TIPOVAČKA ${event} ${nick} ${points} ${rankLabel ?? ""} ${footer}`;
  const fontData = await loadCzechFont(allText);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0a",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <CardBackdrop imageUrl={imageUrl} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            gap: 4,
            paddingTop: 34,
            paddingBottom: 6,
          }}
        >
          <div style={{ display: "flex", fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>
            OKTAGON<span style={{ color: "#FFD400", marginLeft: 12 }}>GARÁŽ</span>
          </div>
          <div style={{ display: "flex", fontSize: 19, letterSpacing: 9, color: "#d4d4d4" }}>
            TIPOVAČKA
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 22,
              padding: "8px 28px",
              border: "3px solid #FFD400",
              borderRadius: 999,
              fontSize: 27,
              fontWeight: 700,
              color: "#FFD400",
              backgroundColor: "rgba(0,0,0,0.35)",
            }}
          >
            {event}
          </div>

          <div style={{ display: "flex", fontSize: 56, fontWeight: 800, marginTop: 24 }}>{nick}</div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              marginTop: 6,
              color: "#FFD400",
              fontWeight: 800,
              textShadow: "0 6px 40px rgba(255,212,0,0.45)",
            }}
          >
            <span style={{ fontSize: 145, lineHeight: 1 }}>{points}</span>
            <span style={{ fontSize: 48, marginLeft: 14 }}>{pointsWord(Number(points))}</span>
          </div>

          {rankLabel && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 16,
                padding: "10px 32px",
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.14)",
                fontSize: 34,
                fontWeight: 700,
              }}
            >
              {rank && MEDAL_COLORS[rank] && <MedalIcon color={MEDAL_COLORS[rank]} size={38} />}
              {rankLabel}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingBottom: 22,
            fontSize: 20,
            letterSpacing: 3,
            color: "#a3a3a3",
          }}
        >
          {footer}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: fontData
        ? [{ name: "Inter", data: fontData, weight: 800 as const, style: "normal" as const }]
        : undefined,
    }
  );
}
