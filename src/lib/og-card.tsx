/** Shared building blocks for the OG share cards (result + podium),
 * rendered by Satori in the edge runtime. */

// podium colors for the lucide Medal icon (gold / silver / bronze)
export const MEDAL_COLORS: Record<string, string> = {
  "1": "#eab308",
  "2": "#a3a3a3",
  "3": "#b45309",
};

/** Inline lucide "medal" icon - Satori renders raw SVG, and using the
 * same icon family as the app's nav keeps the cards on-style. */
export function MedalIcon({ color, size }: { color: string; size: number }) {
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
 * param is caller-controlled and the routes fetch it server-side. */
export function safeImageUrl(raw: string | null): string | null {
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

/** Satori's built-in font lacks Czech diacritics, so fetch an Inter
 * subset from Google Fonts containing the card's glyphs (plus the full
 * Czech alphabet as insurance). Returns null on failure - the card then
 * falls back to the default font, just without háčky/čárky. */
export async function loadCzechFont(text: string): Promise<ArrayBuffer | null> {
  const czechAlphabet =
    "aábcčdďeéěfghiíjklmnňoópqrřsštťuúůvwxyýzž AÁBCČDĎEÉĚFGHIÍJKLMNŇOÓPQRŘSŠTŤUÚŮVWXYÝZŽ0123456789.·:%";
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Inter:wght@800&text=${encodeURIComponent(
      `${text} ${czechAlphabet}`
    )}`;
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
export async function fetchImageDataUri(url: string): Promise<string | null> {
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

/** Blurred, darkened poster + readability gradient + yellow brand bar -
 * the common backdrop of every card. Render as the first children of
 * the root flex column. */
export function CardBackdrop({ imageUrl }: { imageUrl: string | null }) {
  return (
    <>
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
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background:
            "linear-gradient(160deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.82) 100%)",
        }}
      />
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
    </>
  );
}

export function pointsWord(n: number): string {
  if (n === 1) return "bod";
  if (n >= 2 && n <= 4) return "body";
  return "bodů";
}
