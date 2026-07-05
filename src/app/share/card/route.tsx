import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const MEDALS: Record<string, string> = { "1": "🥇", "2": "🥈", "3": "🥉" };

// Renders the shareable result card as a PNG. Param values come from the
// share link itself (friends-app trust model - no signing).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const event = params.get("event") ?? "OKTAGON";
  const nick = params.get("nick") ?? "Tipér";
  const points = params.get("points") ?? "0";
  const rank = params.get("rank");
  const total = params.get("total");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000000",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>
          OKTAGON <span style={{ color: "#FFD400", marginLeft: 12 }}>GARÁŽ</span>
          <span style={{ marginLeft: 12 }}>Tipovačka</span>
        </div>
        <div style={{ display: "flex", fontSize: 32, marginTop: 16, color: "#a3a3a3" }}>{event}</div>
        <div style={{ display: "flex", fontSize: 56, fontWeight: 700, marginTop: 40 }}>{nick}</div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            marginTop: 24,
            color: "#FFD400",
            fontSize: 96,
            fontWeight: 700,
          }}
        >
          {points}
          <span style={{ fontSize: 48, marginLeft: 12 }}>b.</span>
        </div>
        {rank && (
          <div style={{ display: "flex", fontSize: 40, marginTop: 24 }}>
            {MEDALS[rank] ?? ""} {rank}. místo{total ? ` z ${total}` : ""}
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
