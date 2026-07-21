import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { CardBackdrop, loadCzechFont, pointsWord } from "@/lib/og-card";

export const runtime = "edge";

// Season-recap ("Wrapped") share card. Param values come from the share
// link itself - same friends-app trust model as /share/card.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const season = params.get("season") ?? String(new Date().getFullYear());
  const nick = params.get("nick") ?? "Tipér";
  const points = params.get("points") ?? "0";
  const rank = params.get("rank");
  const total = params.get("total");
  const wins = params.get("wins");
  const best = params.get("best");
  const balance = params.get("balance");

  const rankLabel = rank ? `${rank}. místo${total ? ` z ${total}` : ""}` : null;
  const footer = `TIPNI SI TAKY · ${request.nextUrl.host.toUpperCase()}`;
  const chips = [
    wins && Number(wins) > 0 ? `${wins}× král večera` : null,
    best ? `Nejlepší večer: ${best}` : null,
    balance ? `Startovné: ${Number(balance) >= 0 ? "+" : ""}${balance} Kč` : null,
  ].filter(Boolean) as string[];
  const allText = `OKTAGON GARÁŽ TIPOVAČKA SEZÓNA ${season} ${nick} ${points} ${
    rankLabel ?? ""
  } ${chips.join(" ")} ${pointsWord(Number(points))} ${footer}`;
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
        <CardBackdrop imageUrl={null} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            gap: 4,
            paddingTop: 30,
            paddingBottom: 6,
          }}
        >
          <div style={{ display: "flex", fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>
            OKTAGON<span style={{ color: "#FFD400", marginLeft: 12 }}>GARÁŽ</span>
          </div>
          <div style={{ display: "flex", fontSize: 18, letterSpacing: 9, color: "#d4d4d4" }}>
            TIPOVAČKA
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 20,
              padding: "8px 28px",
              border: "3px solid #FFD400",
              borderRadius: 999,
              fontSize: 26,
              fontWeight: 700,
              color: "#FFD400",
              backgroundColor: "rgba(0,0,0,0.35)",
            }}
          >
            SEZÓNA {season}
          </div>

          <div style={{ display: "flex", fontSize: 52, fontWeight: 800, marginTop: 20 }}>{nick}</div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              marginTop: 4,
              color: "#FFD400",
              fontWeight: 800,
              textShadow: "0 6px 40px rgba(255,212,0,0.45)",
            }}
          >
            <span style={{ fontSize: 120, lineHeight: 1 }}>{points}</span>
            <span style={{ fontSize: 42, lineHeight: 1, marginLeft: 14, paddingBottom: 15 }}>
              {pointsWord(Number(points))}
            </span>
          </div>

          {rankLabel && (
            <div
              style={{
                display: "flex",
                marginTop: 12,
                padding: "8px 28px",
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.14)",
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              {rankLabel}
            </div>
          )}

          {chips.length > 0 && (
            <div style={{ display: "flex", gap: 14, marginTop: 18, flexWrap: "wrap", justifyContent: "center" }}>
              {chips.map((chip) => (
                <div
                  key={chip}
                  style={{
                    display: "flex",
                    padding: "7px 20px",
                    borderRadius: 999,
                    backgroundColor: "rgba(255,212,0,0.16)",
                    border: "2px solid rgba(255,212,0,0.5)",
                    fontSize: 22,
                    fontWeight: 700,
                  }}
                >
                  {chip}
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingBottom: 20,
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
