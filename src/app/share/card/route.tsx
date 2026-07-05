import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

// podium colors for the lucide Medal icon (gold / silver / bronze)
const MEDAL_COLORS: Record<string, string> = { "1": "#eab308", "2": "#a3a3a3", "3": "#b45309" };

/** Inline lucide "medal" icon - Satori renders raw SVG, and using the
 * same icon family as the app's nav keeps the card on-style (no emoji). */
function MedalIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" />
      <path d="M11 12 5.12 2.2" />
      <path d="m13 12 5.88-9.8" />
      <path d="M8 7h8" />
      <circle cx="12" cy="17" r="5" />
      <path d="M12 18v-2h-.5" />
    </svg>
  );
}

/** The event poster may only come from OKTAGON's own asset host - the
 * param is caller-controlled and this route fetches it server-side. */
function safeImageUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" && url.hostname.endsWith("oktagonmma.com")) {
      return url.toString();
    }
  } catch {
    // not a URL - ignore
  }
  return null;
}

/** Satori's built-in font lacks Czech diacritics (GARÁŽ renders as
 * GARAZ), so fetch an Inter subset from Google Fonts containing exactly
 * the glyphs on this card. Returns null on failure - the card then
 * falls back to the default font, just without háčky/čárky. */
async function loadCzechFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Inter:wght@800&text=${encodeURIComponent(text)}`;
    // no modern browser UA -> Google serves TTF, which Satori can parse
    const css = await (await fetch(cssUrl, { signal: AbortSignal.timeout(3000) })).text();
    const match = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/);
    if (!match) return null;
    const resp = await fetch(match[1], { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) return null;
    return await resp.arrayBuffer();
  } catch {
    return null;
  }
}

/** Pre-fetches the poster and inlines it as a data URI - if the asset
 * host is slow or down, the card just renders without a background
 * instead of failing entirely. */
async function fetchImageDataUri(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) return null;
    const contentType = resp.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const bytes = new Uint8Array(await resp.arrayBuffer());
    let binary = "";
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

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
  const pointsNum = Number(points);
  const pointsWord = pointsNum === 1 ? "bod" : pointsNum >= 2 && pointsNum <= 4 ? "body" : "bodů";

  const footer = `TIPNI SI TAKY · ${request.nextUrl.host.toUpperCase()}`;
  const czechAlphabet =
    "aábcčdďeéěfghiíjklmnňoópqrřsštťuúůvwxyýzž AÁBCČDĎEÉĚFGHIÍJKLMNŇOÓPQRŘSŠTŤUÚŮVWXYÝZŽ0123456789.·:%";
  const allText = `${event} ${nick} ${points} ${rankLabel ?? ""} ${footer} ${czechAlphabet}`;
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
        {imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt=""
            width={1400}
            height={788}
            style={{
              position: "absolute",
              top: -79,
              left: -100,
              objectFit: "cover",
              filter: "blur(22px) brightness(0.5) saturate(1.2)",
            }}
          />
        )}
        {/* dark gradient so text always sits on a readable base */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(160deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.82) 100%)",
          }}
        />
        {/* yellow brand bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            display: "flex",
            width: "100%",
            height: 14,
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
            <span style={{ fontSize: 48, marginLeft: 14 }}>{pointsWord}</span>
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
