// Builds the AWS product ground truth for NEXUS from AWS's own pages (no hand-typed product facts).
// Sources: the products page https://aws.amazon.com/products/ (its embedded navigation: current products by category)
// and the product directory feed the page uses (summary, launch date, product and pricing links, service or feature).
// Usage (Docker, as everything else): docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/w -w /w node:22-slim node packs/catalog/fetch-aws.mjs
// Writes packs/catalog/aws.products.json; then run packs/catalog/coverage.mjs to map it to NEXUS.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const PAGE = "https://aws.amazon.com/products/";
const FEED = "https://aws.amazon.com/api/dirs/items/search?item.directoryId=aws-products&sort_by=item.additionalFields.productNameLowercase&sort_order=asc&size=1000&item.locale=en_US";
const NOT_PRODUCTS = /^(What's new|Customer success stories)$/i;
const NAV_CATEGORIES_SKIP = /^(Discover AWS|Featured Products|Featured|By industry|By organization type|Solutions Library|Pricing|Resources)$/;
export const slugOf = (u) => {
  const x = String(u || "").split("?")[0].split("#")[0];
  const m = /^https?:\/\/([^/]+)(\/.*)?$/.exec(x);
  if (m && m[1] !== "aws.amazon.com") return (m[1] + (m[2] || "")).replace(/\/+$/, "").toLowerCase(); // off-site product (e.g. kiro.dev)
  return x.replace(/^https?:\/\/aws\.amazon\.com/, "").replace(/^\/+|\/+$/g, "").replace(/^products\//, "").toLowerCase();
};
const clean = (t) => String(t || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;| /g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

export function parseNav(html) {
  const blobs = [...html.matchAll(/<script type="application\/json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let nav = null;
  for (const b of blobs) { try { for (const it of JSON.parse(b)?.data?.items || []) if (it?.fields?.globalNav) nav = JSON.parse(it.fields.globalNav); } catch { /* not JSON */ } }
  if (!nav) throw new Error("products page: navigation data not found (page layout changed?)");
  const out = [];
  const walk = (o, cat, sec) => {
    if (Array.isArray(o)) return o.forEach((v) => walk(v, cat, sec));
    if (!o || typeof o !== "object") return;
    if (o.name && o.columns) cat = o.name;
    if (o.heading && o.items && o.heading !== cat) sec = o.heading;
    if (o.title && o.hyperLink && o.body !== undefined && cat && !NAV_CATEGORIES_SKIP.test(cat) && !NOT_PRODUCTS.test(o.title) && !/^Browse all/i.test(o.title))
      out.push({ category: cat, section: sec || null, name: clean(o.title), summary: clean(o.body), url: new URL(o.hyperLink, "https://aws.amazon.com").href.split("?")[0] });
    Object.values(o).forEach((v) => walk(v, cat, sec));
  };
  walk(nav, null, null);
  return out;
}
export function parseFeed(json) {
  return (json.items || []).map(({ item, tags }) => {
    const f = item.additionalFields || {}, tag = (ns) => (tags || []).filter((t) => t.tagNamespaceId === ns).map((t) => t.name);
    return { id: item.name, name: clean(f.productName), summary: clean(f.productSummary), category: f.productCategory || null, type: (tag("aws-products#type")[0] || "").toLowerCase() || null,
      launched: f.launchDate || null, url: (f.productUrl || "").split("?")[0] || null, pricing: (f.pricingUrl || "").split("?")[0] || null, techCategories: tag("GLOBAL#tech-category"), updated: item.dateUpdated };
  });
}
export function merge(nav, feed) {
  const by = new Map();
  for (const p of feed) {
    const k = slugOf(p.url) || p.id;
    if (!by.has(k)) by.set(k, { id: k, name: p.name, summary: p.summary, kind: p.type === "service" ? "service" : p.type ? "feature" : "unknown", categories: [], directoryCategory: p.category, launched: p.launched, url: p.url, pricing: p.pricing, onProductsPage: false, inDirectory: true, directoryUpdated: p.updated });
  }
  for (const n of nav) {
    const k = slugOf(n.url);
    const cur = by.get(k) || { id: k, name: n.name, summary: n.summary, kind: "service", categories: [], directoryCategory: null, launched: null, url: n.url, pricing: null, onProductsPage: false, inDirectory: false };
    cur.onProductsPage = true;
    if (!cur.categories.includes(n.category)) cur.categories.push(n.category);
    if (n.section && !(cur.sections || []).includes(n.section)) cur.sections = [...(cur.sections || []), n.section];
    cur.pageName = n.name; cur.pageSummary = n.summary;
    by.set(k, cur);
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const ua = { headers: { "user-agent": "nexus-catalog/1.0 (architecture tool; reads the public product list)" } };
  const html = await (await fetch(PAGE, ua)).text();
  const feed = await (await fetch(FEED, ua)).json();
  const nav = parseNav(html), items = parseFeed(feed), products = merge(nav, items);
  const out = { provider: "aws", fetched: new Date().toISOString().slice(0, 10), sources: [PAGE, FEED.split("&")[0] + "&…"],
    counts: { productsPage: nav.length, directory: items.length, merged: products.length, onProductsPage: products.filter((p) => p.onProductsPage).length, services: products.filter((p) => p.kind === "service").length },
    note: "Names, summaries, categories, links and launch dates are AWS's own text. onProductsPage: listed on the products page today. inDirectory only: in AWS's product directory feed but not on the current page (renamed, retired or a feature); check before use.",
    products };
  writeFileSync(join(here, "aws.products.json"), JSON.stringify(out, null, 1) + "\n");
  console.log(`aws catalog: ${out.counts.merged} entries (${out.counts.onProductsPage} on the products page, ${out.counts.services} services)`);
}
