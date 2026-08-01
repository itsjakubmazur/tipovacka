import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { fetchImageDataUri, loadCzechFont, pointsWord, safeImageUrl } from "@/lib/og-card";

export const runtime = "edge";

/** Portrait, because this card exists to be posted into a story or a group
 * chat - the old 1200×630 landscape was the wrong shape for both. */
const WIDTH = 1080;
const HEIGHT = 1920;
/** Enough posters to read as a mosaic, few enough that inlining them as data
 * URIs doesn't blow up the edge function. */
const MAX_POSTERS = 6;

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
  const accuracy = params.get("acc");
  const best = params.get("best");
  const balance = params.get("balance");
  const typeName = params.get("type");
  const typeCode = params.get("code");

  // Only OKTAGON's own asset host, and only what actually loads - a slow or
  // missing poster costs the mosaic a tile, not the whole card.
  const posterUrls = params
    .getAll("poster")
    .map(safeImageUrl)
    .filter((url): url is string => url !== null)
    .slice(0, MAX_POSTERS);
  const posters = (await Promise.all(posterUrls.map(fetchImageDataUri))).filter(
    (uri): uri is string => uri !== null
  );

  const rankLabel = rank ? `${rank}. místo${total ? ` z ${total}` : ""}` : null;
  const footer = `TIPNI SI TAKY · ${request.nextUrl.host.toUpperCase()}`;
  const chips = [
    wins && Number(wins) > 0 ? `${wins}× král večera` : null,
    accuracy ? `Úspěšnost ${accuracy} %` : null,
    best ? `Nejlepší večer: ${best}` : null,
    balance ? `Startovné: ${Number(balance) >= 0 ? "+" : ""}${balance} Kč` : null,
  ].filter(Boolean) as string[];

  const allText = `OKTAGON GARÁŽ TIPOVAČKA SEZÓNA ${season} ${nick} ${points} ${
    rankLabel ?? ""
  } ${typeName ?? ""} ${typeCode ?? ""} ${chips.join(" ")} ${pointsWord(Number(points))} ${footer}`;
  const fontData = await loadCzechFont(allText);

  // Tiles are laid out by hand rather than with a wrapping flex row: Satori's
  // wrap support is shaky, and an explicit 3×N grid of absolutely placed
  // images is predictable.
  const columns = 3;
  const tileWidth = Math.ceil((WIDTH * 1.6) / columns);
  const tileHeight = Math.round(tileWidth * 1.33);
  const rows = posters.length ? Math.ceil((HEIGHT * 1.4) / tileHeight) : 0;
  const tiles: { src: string; left: number; top: number }[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      tiles.push({
        src: posters[(row * columns + col) % posters.length],
        left: col * tileWidth,
        top: row * tileHeight,
      });
    }
  }

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
        {/* the season's own posters, tilted and blurred into a backdrop */}
        {tiles.length > 0 && (
          <div
            style={{
              position: "absolute",
              left: -WIDTH * 0.3,
              top: -HEIGHT * 0.2,
              width: WIDTH * 1.6,
              height: HEIGHT * 1.4,
              display: "flex",
              transform: "rotate(-8deg)",
              filter: "blur(26px) brightness(0.55) saturate(1.25)",
            }}
          >
            {tiles.map((tile, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={i}
                src={tile.src}
                alt=""
                width={tileWidth - 10}
                height={tileHeight - 10}
                style={{
                  position: "absolute",
                  left: tile.left,
                  top: tile.top,
                  objectFit: "cover",
                  borderRadius: 24,
                }}
              />
            ))}
          </div>
        )}

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(160deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.88) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            display: "flex",
            width: "100%",
            height: 20,
            backgroundColor: "#FFD400",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            gap: 6,
            paddingTop: 60,
            paddingBottom: 40,
            paddingLeft: 60,
            paddingRight: 60,
          }}
        >
          <div style={{ display: "flex", fontSize: 54, fontWeight: 800, letterSpacing: -1 }}>
            OKTAGON<span style={{ color: "#FFD400", marginLeft: 16 }}>GARÁŽ</span>
          </div>
          <div style={{ display: "flex", fontSize: 24, letterSpacing: 12, color: "#d4d4d4" }}>
            TIPOVAČKA
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 36,
              padding: "12px 40px",
              border: "4px solid #FFD400",
              borderRadius: 999,
              fontSize: 36,
              fontWeight: 700,
              color: "#FFD400",
              backgroundColor: "rgba(0,0,0,0.35)",
            }}
          >
            SEZÓNA {season}
          </div>

          <div style={{ display: "flex", fontSize: 76, fontWeight: 800, marginTop: 40 }}>{nick}</div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              marginTop: 8,
              color: "#FFD400",
              fontWeight: 800,
              textShadow: "0 8px 60px rgba(255,212,0,0.45)",
            }}
          >
            <span style={{ fontSize: 200, lineHeight: 1 }}>{points}</span>
            <span style={{ fontSize: 64, lineHeight: 1, marginLeft: 20, paddingBottom: 24 }}>
              {pointsWord(Number(points))}
            </span>
          </div>

          {rankLabel && (
            <div
              style={{
                display: "flex",
                marginTop: 20,
                padding: "12px 40px",
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.14)",
                fontSize: 42,
                fontWeight: 700,
              }}
            >
              {rankLabel}
            </div>
          )}

          {typeName && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                marginTop: 56,
                gap: 4,
              }}
            >
              <div style={{ display: "flex", fontSize: 22, letterSpacing: 8, color: "#a3a3a3" }}>
                TIPÉRSKÝ TYP
              </div>
              {typeCode && (
                <div
                  style={{ display: "flex", fontSize: 26, letterSpacing: 14, color: "#FFD400" }}
                >
                  {typeCode}
                </div>
              )}
              <div style={{ display: "flex", fontSize: 68, fontWeight: 800 }}>{typeName}</div>
            </div>
          )}

          {chips.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 16,
                marginTop: 48,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {chips.map((chip) => (
                <div
                  key={chip}
                  style={{
                    display: "flex",
                    padding: "12px 28px",
                    borderRadius: 999,
                    backgroundColor: "rgba(255,212,0,0.16)",
                    border: "2px solid rgba(255,212,0,0.5)",
                    fontSize: 30,
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
            paddingBottom: 48,
            fontSize: 26,
            letterSpacing: 4,
            color: "#a3a3a3",
          }}
        >
          {footer}
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: fontData
        ? [{ name: "Inter", data: fontData, weight: 800 as const, style: "normal" as const }]
        : undefined,
    }
  );
}
