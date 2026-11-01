// Copies the prototype canvas into public/workbench so the app can embed it (same origin).
// The prototype stays the source until the canvas is ported to React components.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../poc/prototype/index.html");
const dst = resolve(here, "../public/workbench/index.html");
if (!existsSync(src)) {
  console.error(`sync-workbench: ${src} not found`);
  process.exit(1);
}
mkdirSync(dirname(dst), { recursive: true });
copyFileSync(src, dst);
console.log("sync-workbench: copied prototype canvas to public/workbench/");
