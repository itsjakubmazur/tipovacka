// The emoji reaction picker used to load Apple-style emoji images
// straight from jsDelivr at runtime - that CDN turned out to be
// unreliable in practice (every tile fell back to emoji-mart's "#"
// placeholder), so these are self-hosted from the emoji-datasource-apple
// package instead. public/emoji/apple is committed to git (so
// production never depends on this script actually running at deploy
// time) - this is just how to regenerate it after bumping the
// emoji-datasource-apple version: `node scripts/copy-emoji-assets.mjs`,
// then commit whatever changed under public/emoji.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/emoji-datasource-apple/img/apple");
const dest = join(root, "public/emoji/apple");

if (!existsSync(src)) {
  console.warn("emoji-datasource-apple not found, skipping emoji asset copy");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
cpSync(join(src, "64"), join(dest, "64"), { recursive: true });
cpSync(join(src, "sheets-256/64.png"), join(dest, "sheets-256-64.png"));
console.log("Copied Apple emoji assets into public/emoji/apple");
