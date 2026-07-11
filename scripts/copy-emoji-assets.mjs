// Runs on every `npm install` (see package.json postinstall). The
// emoji reaction picker used to load Apple-style emoji images straight
// from jsDelivr at runtime - that CDN turned out to be unreliable in
// practice (every tile fell back to emoji-mart's "#" placeholder), so
// these get self-hosted from the emoji-datasource-apple package
// instead. Not committed to git (see .gitignore) - regenerated fresh
// from node_modules on every install.
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
