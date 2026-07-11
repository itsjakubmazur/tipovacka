/** emoji-mart's <em-emoji>/<em-emoji-picker> custom elements share one
 * module-level data store, populated once via init() - they don't
 * accept `data` directly as a per-element prop. Side-effect-only
 * module: importing it (from emoji-glyph.tsx or the picker sheet) is
 * enough, ES module caching keeps this running exactly once no matter
 * how many places import it. */
import { init } from "emoji-mart";
import data from "@emoji-mart/data";

init({ data, set: "apple" });

/** emoji-mart's default image/spritesheet URLs point at jsDelivr, which
 * turned out unreliable in practice (every tile fell back to its "#"
 * placeholder). Both self-hosted from emoji-datasource-apple instead -
 * see scripts/copy-emoji-assets.mjs, which copies them into public/
 * on every install. */
export const emojiImageUrl = (_set: string, unified: string) => `/emoji/apple/64/${unified}.png`;
export const emojiSpritesheetUrl = () => "/emoji/apple/sheets-256-64.png";
