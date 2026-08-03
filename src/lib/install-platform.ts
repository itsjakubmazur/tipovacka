/** Which platform is this, and how does one install the app on it.
 *
 * One source of truth for both places that talk about installing: the nudge
 * that floats over the app and the reference guide on the profile. They used
 * to be able to give different instructions for the same phone.
 */

export type InstallPlatform =
  | "ios"
  | "ios-other-browser"
  | "android"
  | "macos-safari"
  | "desktop-chromium"
  | "unsupported";

export type InstallGuide = {
  platform: InstallPlatform;
  /** The whole headline, not just the noun: Czech wants a different
   * preposition for the home screen ("na plochu") than for the Dock ("do
   * Docku"), so gluing one word onto a fixed sentence gets it wrong. */
  title: string;
  /** one line on why it is worth doing here specifically */
  why: string;
  /** the steps, when there is no install button to press */
  steps: string[];
};

function ua(): string {
  return typeof navigator === "undefined" ? "" : navigator.userAgent;
}

/** iPadOS 13+ reports itself as a Mac. The touch points are the giveaway: a
 * real desktop Safari reports 0, an iPad reports 5. */
function isIpadOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Macintosh/.test(ua()) && navigator.maxTouchPoints > 1;
}

export function isIosLike(): boolean {
  return /iPad|iPhone|iPod/.test(ua()) || isIpadOS();
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function detectInstallPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "unsupported";
  const agent = ua();

  if (isIosLike()) {
    // Every browser on iOS runs on WebKit, but only Safari offers "Add to
    // Home Screen" - in Chrome or Firefox the share sheet has no such item,
    // so sending someone there would be sending them on a wrong errand.
    const isSafari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(agent);
    return isSafari ? "ios" : "ios-other-browser";
  }

  if (/Android/.test(agent)) return "android";

  // Safari 17 on macOS installs web apps into the Dock. Chromium-based
  // desktop browsers report Safari in their UA too, hence the exclusions.
  const isDesktopSafari = /Safari/.test(agent) && !/Chrome|Chromium|Edg|OPR/.test(agent);
  if (/Macintosh/.test(agent) && isDesktopSafari) return "macos-safari";

  if (/Chrome|Chromium|Edg|OPR/.test(agent)) return "desktop-chromium";

  // Desktop Firefox has no install at all - better to say nothing than to
  // describe a menu item that isn't there.
  return "unsupported";
}

const GUIDES: Record<Exclude<InstallPlatform, "unsupported">, Omit<InstallGuide, "platform">> = {
  ios: {
    title: "Přidej si tipovačku na plochu",
    why: "Na iPhonu a iPadu jinak nepůjdou zapnout upozornění na uzávěrky tipů.",
    steps: [
      "Klepni dole na ikonu Sdílet (čtvereček se šipkou nahoru).",
      "Sjeď níž a vyber „Přidat na plochu“.",
      "Potvrď „Přidat“ a otevři tipovačku z nové ikony.",
    ],
  },
  "ios-other-browser": {
    title: "Přidej si tipovačku na plochu",
    why: "Na iPhonu umí přidat na plochu jenom Safari — v tomhle prohlížeči to nejde.",
    steps: [
      "Otevři tipovačku v Safari.",
      "Klepni dole na ikonu Sdílet a vyber „Přidat na plochu“.",
    ],
  },
  android: {
    title: "Přidej si tipovačku na plochu",
    why: "Otevírá se rychleji, běží přes celou obrazovku a chodí ti upozornění na uzávěrky.",
    steps: [
      "Klepni vpravo nahoře na tři tečky.",
      "Vyber „Instalovat aplikaci“ nebo „Přidat na plochu“.",
    ],
  },
  "macos-safari": {
    title: "Přidej si tipovačku do Docku",
    why: "Tipovačka se pak otevírá jako běžná aplikace, ve vlastním okně a bez panelů.",
    steps: ["Klepni nahoře na ikonu Sdílet.", "Vyber „Přidat do Docku“."],
  },
  "desktop-chromium": {
    title: "Nainstaluj si tipovačku",
    why: "Tipovačka se pak otevírá ve vlastním okně, bez adresního řádku a panelů.",
    steps: [
      "Klepni vpravo v adresním řádku na ikonu instalace (monitor se šipkou).",
      "Nebo v menu ⋮ vyber „Přenést“ → „Nainstalovat stránku jako aplikaci“.",
    ],
  },
};

export function installGuide(platform: InstallPlatform): InstallGuide | null {
  if (platform === "unsupported") return null;
  return { platform, ...GUIDES[platform] };
}
