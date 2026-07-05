import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const MEDALS: Record<string, string> = { "1": "🥇", "2": "🥈", "3": "🥉" };

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
              filter: "blur(18px) brightness(0.45)",
            }}
          />
        )}
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
