// AWS product ground truth: parsing AWS's page and feed, merging, and the NEXUS map staying valid.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { slugOf, parseNav, parseFeed, merge } from "../catalog/fetch-aws.mjs";
import { coverage } from "../catalog/coverage.mjs";
import { loadPacks } from "../build.mjs";
const cat = JSON.parse(readFileSync(new URL("../catalog/aws.products.json", import.meta.url)));
const map = JSON.parse(readFileSync(new URL("../catalog/aws.nexus-map.json", import.meta.url)));
const packs = loadPacks(), pl = packs.find((p) => p.id === "core.placement"), types = new Set([...Object.keys(pl.types), ...Object.keys(pl.families)]);

test("slugs: AWS paths, product pages and off-site products", () => {
  assert.equal(slugOf("https://aws.amazon.com/lambda/?nc2=h_prod_cp_lbd"), "lambda");
  assert.equal(slugOf("/products/connect/customer/?nc2=x"), "connect/customer");
  assert.equal(slugOf("https://aws.amazon.com/rds/aurora/"), "rds/aurora");
  assert.equal(slugOf("https://kiro.dev/?nc2=h_prod_ai_kiro"), "kiro.dev");
});
test("parsing: the page's navigation JSON and the directory feed, merged without duplicates", () => {
  const nav = { columns: [], x: [{ name: "Compute", columns: [{ heading: "Compute", items: [{ title: "Lambda", body: "Run code", hyperLink: "/lambda/?nc2=a" }, { title: "What's new", body: "", hyperLink: "/new/" }] }] },
    { name: "Serverless", columns: [{ heading: "Serverless", items: [{ title: "Lambda", body: "Run code", hyperLink: "/lambda/?nc2=b" }] }] }] };
  const html = `<script type="application/json">${JSON.stringify({ data: { items: [{ fields: { globalNav: JSON.stringify(nav) } }] } })}</script>`;
  const n = parseNav(html);
  assert.deepEqual(n.map((x) => x.name), ["Lambda", "Lambda"]);
  const f = parseFeed({ items: [{ item: { name: "aws-lambda", dateUpdated: "2024", additionalFields: { productName: "AWS Lambda", productSummary: "<p>Serverless compute</p>", productCategory: "Compute", productUrl: "https://aws.amazon.com/lambda/?did=x", launchDate: "2014-11-13" } }, tags: [{ tagNamespaceId: "aws-products#type", name: "Service" }] },
    { item: { name: "old", dateUpdated: "2022", additionalFields: { productName: "Old thing", productUrl: "https://aws.amazon.com/old/" } }, tags: [{ tagNamespaceId: "aws-products#type", name: "Feature" }] }] });
  const m = merge(n, f);
  const l = m.find((p) => p.id === "lambda");
  assert.equal(m.length, 2);
  assert.deepEqual(l.categories, ["Compute", "Serverless"]);
  assert.equal(l.summary, "Serverless compute");
  assert.ok(l.onProductsPage && l.inDirectory);
  assert.equal(m.find((p) => p.id === "old").onProductsPage, false);
});
test("the stored catalogue is AWS's: sources, counts and the core products", () => {
  assert.match(cat.sources[0], /^https:\/\/aws\.amazon\.com\/products\//);
  assert.ok(cat.products.length > 300 && cat.counts.onProductsPage > 80);
  for (const id of ["lambda", "ecs", "msk", "s3", "cloudfront", "route53", "dynamodb", "rds/aurora", "bedrock", "directconnect"]) assert.ok(cat.products.some((p) => p.id === id), id);
});
test("the NEXUS map is valid: products exist, families, types and packs are known", () => {
  const { errs } = coverage(cat, map, packs, types);
  assert.deepEqual(errs, []);
});
test("coverage levels follow the packs", () => {
  const { products } = coverage(cat, map, packs, types), lv = (id) => products.find((p) => p.id === id).nexus.coverage;
  assert.equal(lv("msk"), "service-pack");
  assert.equal(lv("ecs"), "service-pack");
  assert.equal(lv("cloudfront"), "component-pack");
  assert.equal(lv("cognito"), "canvas-type");
  assert.equal(lv("directconnect"), "not-modelled");
  assert.match(products.find((p) => p.id === "app-mesh").nexus.retired, /30 September 2026/);
});
test("product search for the palette and console: names, abbreviations, generic words stay generic", async () => {
  const { block } = await import("../build.mjs");
  const html = block(), j = JSON.parse(html.match(/<script id="nexusPacks" type="application\/json">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, "<"));
  const R = (await import("node:module")).createRequire(import.meta.url)("../runtime.js"); R.load(j);
  assert.equal(R.matchProduct("aws", "route 53").i, "route53");
  assert.equal(R.matchProduct("aws", "msk").i, "msk");
  assert.equal(R.matchProduct("aws", "direct connect").i, "directconnect");
  assert.equal(R.matchProduct("aws", "database"), null, "a generic word is not a product");
  assert.equal(R.matchProduct("aws", "cache"), null);
  assert.ok(R.findProducts("aws", "kafka").some((p) => p.i === "msk"));
  assert.ok(R.catalog("aws").length > 250);
});
