const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/pravidla",
  "/auth/reset",
  "/share",
  "/manifest.webmanifest",
  "/sw.js",
  "/icon",
  "/apple-icon",
]);

const PUBLIC_PREFIXES = ["/share/", "/auth/", "/api/"];

/** Routes that do not require a signed-in session. Everything else
 * is gated in `proxy.ts` so a forgotten `getUser()` on a page cannot
 * leak the private card. */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
