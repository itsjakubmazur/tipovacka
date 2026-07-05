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

// Podium block heights, silver / gold / bronze in display order
const PODIUM = [
  { rank: 2, height: 120 },
  { rank: 1, height: 170 },
  { rank: 3, height: 90 },
];

// Renders the top-3 podium card for an event as a PNG. Params:
// event, img, n1/p1, n2/p2, n3/p3 (nickname/points per rank).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const event = params.get("event") ?? "OKTAGON";
  const rawImageUrl = safeImageUrl(params.get("img"));
  const imageUrl = rawImageUrl ? await fetchImageDataUri(rawImageUrl) : null;

  const places = [1, 2, 3]
    .map((rank) => ({
      rank,
      nick: params.get(`n${rank}`),
      points: params.get(`p${rank}`),
    }))
    .filter((p): p is { rank: number; nick: string; points: string } => !!p.nick && p.points != null);

  const footer = `TIPNI SI TAKY · ${request.nextUrl.host.toUpperCase()}`;
  const allText = `OKTAGON GARÁŽ TIPOVAČKA NEJLEPŠÍ TIPEŘI ${event} ${places
    .map((p) => `${p.nick} ${p.points}`)
    .join(" ")} ${footer}`;
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
            paddingTop: 44,
            gap: 4,
          }}
        >
          <div style={{ display: "flex", fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>
            OKTAGON<span style={{ color: "#FFD400", marginLeft: 12 }}>GARÁŽ</span>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 14,
              padding: "8px 28px",
              border: "3px solid #FFD400",
              borderRadius: 999,
              fontSize: 26,
              fontWeight: 700,
              color: "#FFD400",
              backgroundColor: "rgba(0,0,0,0.35)",
            }}
          >
            {event} · NEJLEPŠÍ TIPEŘI
          </div>
        </div>

        {/* podium */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "flex-end",
            justifyContent: "center",
            gap: 26,
            padding: "0 80px",
          }}
        >
          {PODIUM.map(({ rank, height }) => {
            const place = places.find((p) => p.rank === rank);
            if (!place) return <div key={rank} style={{ display: "flex", width: 280 }} />;
            return (
              <div
                key={rank}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: 300,
                  gap: 10,
                }}
              >
                <MedalIcon color={MEDAL_COLORS[String(rank)]} size={rank === 1 ? 62 : 48} />
                <div
                  style={{
                    display: "flex",
                    fontSize: rank === 1 ? 44 : 34,
                    fontWeight: 800,
                    maxWidth: 300,
                  }}
                >
                  {place.nick}
                </div>
                <div
                  style={{
                    display: "flex",
                    // Satori has no real baseline alignment - align bottoms
                    // and lift the small word by the descent difference
                    alignItems: "flex-end",
                    gap: 8,
                    color: "#FFD400",
                    fontWeight: 800,
                  }}
                >
                  <span style={{ fontSize: rank === 1 ? 56 : 42, lineHeight: 1 }}>{place.points}</span>
                  <span
                    style={{
                      fontSize: rank === 1 ? 26 : 21,
                      lineHeight: 1,
                      paddingBottom: rank === 1 ? 6 : 4,
                    }}
                  >
                    {pointsWord(Number(place.points))}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    width: "100%",
                    height,
                    paddingTop: 10,
                    borderRadius: "14px 14px 0 0",
                    background:
                      rank === 1
                        ? "linear-gradient(180deg, rgba(255,212,0,0.85), rgba(255,212,0,0.25))"
                        : "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0.08))",
                    fontSize: 44,
                    fontWeight: 800,
                    color: rank === 1 ? "#000000" : "#ffffff",
                  }}
                >
                  {rank}.
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingBottom: 20,
            paddingTop: 14,
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
