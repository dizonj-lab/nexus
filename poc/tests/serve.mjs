// Minimal static server for the browser checks: serves poc/ (so the canvas is at /prototype/index.html).
// Usage: node poc/tests/serve.mjs [port]   (default 18081)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = +process.argv[2] || 18081;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(root, path); if (file.endsWith("/")) file += "index.html";
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  try { const body = await readFile(file); res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end("not found"); }
}).listen(port, () => console.log(`serving poc/ on :${port}`));
