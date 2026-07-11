/** emoji-mart's <em-emoji>/<em-emoji-picker> custom elements share one
 * module-level data store, populated once via init() - they don't
 * accept `data` directly as a per-element prop. Side-effect-only
 * module: importing it (from emoji-glyph.tsx or the picker sheet) is
 * enough, ES module caching keeps this running exactly once no matter
 * how many places import it. */
import { init } from "emoji-mart";
import data from "@emoji-mart/data";

init({ data, set: "apple" });
