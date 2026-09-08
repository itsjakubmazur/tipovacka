/** emoji-mart's <em-emoji>/<em-emoji-picker> custom elements share one
 * module-level data store, populated once via init() - they don't
 * accept `data` directly as a per-element prop. Side-effect-only
 * module: importing it (from emoji-glyph.tsx or the picker sheet) is
 * enough, ES module caching keeps this running exactly once no matter
 * how many places import it. */
import type { CSSProperties } from "react";
import { init, SearchIndex } from "emoji-mart";
// @emoji-mart/data's package.json "main" resolves to sets/15/native.json,
// whose skins have no sheet x/y coordinates at all (only per-set files
// like apple.json do) - loading it was why the picker grid rendered
// every tile as "#": background-position needs those coordinates,
// which were all `undefined` regardless of the self-hosted sheet image
// being perfectly fine. Import the apple set explicitly instead.
import data from "@emoji-mart/data/sets/15/apple.json";

/** Sheet geometry comes from the dataset rather than being hardcoded, so
 * bumping @emoji-mart/data can't silently shift every glyph by a row. */
const sheet = (data as unknown as { sheet: { cols: number; rows: number } }).sheet;

/** init() resolves once the store is populated. SearchIndex.get() is
 * synchronous but returns nothing until then, so anything doing its own
 * lookup has to wait on this first. */
export const emojiReady: Promise<unknown> = init({ data, set: "apple" });
let ready = false;
void emojiReady.then(() => {
  ready = true;
});

/** The self-hosted Apple spritesheet. emoji-mart's default points at
 * jsDelivr, which turned out unreliable in practice (every tile fell
 * back to its "#" placeholder) - see scripts/copy-emoji-assets.mjs. */
export const emojiSpritesheetUrl = () => "/emoji/apple/sheets-256-64.png";

type SpriteSkin = { x?: number; y?: number };

/** emoji-mart ships the minified internal name `_get2` in its .d.ts while
 * exporting `get` at runtime, so the public lookup is untypeable without
 * this cast. Verified against the built package: SearchIndex's runtime
 * keys are search / get / reset / SHORTCODES_REGEX. */
function lookupSkin(native: string): SpriteSkin | undefined {
  const index = SearchIndex as unknown as {
    get: (id: string) => { skins?: SpriteSkin[] } | undefined;
  };
  return index.get(native)?.skins?.[0];
}

/** Where `native` sits on the spritesheet, or null if the dataset has no
 * entry for it (odd custom sequences) or isn't loaded yet - callers
 * render the raw character in that case.
 *
 * This is the same background-size/background-position math emoji-mart
 * uses internally for the picker grid. We repeat it because the
 * <em-emoji> element cannot be told to use a spritesheet: its prop list
 * is just {fallback, id, native, shortcodes, size, set, skin}, and
 * getProps() iterates *only* over declared props, so `spritesheet`,
 * `getSpritesheetURL` and `getImageURL` are all silently dropped on the
 * way in. Passing getImageURL there looked like it self-hosted the
 * glyphs and in fact left them loading from jsDelivr. */
export function emojiSpriteStyle(native: string, size: number): CSSProperties | null {
  if (!ready) return null;
  const skin = lookupSkin(native);
  if (!skin || skin.x === undefined || skin.y === undefined) return null;
  return {
    width: size,
    height: size,
    backgroundImage: `url(${emojiSpritesheetUrl()})`,
    backgroundSize: `${100 * sheet.cols}% ${100 * sheet.rows}%`,
    backgroundPosition: `${(100 / (sheet.cols - 1)) * skin.x}% ${(100 / (sheet.rows - 1)) * skin.y}%`,
  };
}
