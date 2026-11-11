# Provider catalogues: the ground truth for new Service Packs

What a cloud provider offers, taken from the provider's own pages, joined with how NEXUS models each
product. New Service Packs (and the skills that build them) start here.

| File | What | Who writes it |
|---|---|---|
| `fetch-aws.mjs` | Reads https://aws.amazon.com/products/ (its embedded navigation: current products by category) and the product directory feed the page uses | — |
| `aws.products.json` | AWS's list: name, summary, categories, service or feature, launch date, product and pricing links, whether it is on today's products page | Generated; never edited by hand |
| `aws.nexus-map.json` | NEXUS decisions per product: component type, flavor, scope (block template v2), Service Pack family, tier, packs that cover it, retirement notes | Curated by NEXUS (reviewed like code) |
| `coverage.mjs` | Joins the two with the packs that exist; fails on an unknown product, type, family or pack | — |
| `aws.nexus.json` | One record per product: AWS's facts plus NEXUS type, scope, family, tier and coverage | Generated |
| `../../docs/design/AWS-GROUND-TRUTH.md` | The human view: coverage counts, the Service Pack backlog in order, every mapped product | Generated |

Coverage levels: **service-pack** (meets the Service Pack standard) · **component-pack** (sourced facts, legacy level 1) ·
**canvas-type** (drawable, planning assumptions only) · **not-modelled**.

## Refresh

```bash
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/w -w /w node:22-slim node packs/catalog/fetch-aws.mjs
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/w -w /w node:22-slim node packs/catalog/coverage.mjs
```

Behind an HTTP proxy, add `-e NODE_USE_ENV_PROXY=1 -e HTTPS_PROXY` (Node 22.21 or later). Review the diff of
`aws.products.json`: new products, renamed ones, and products that left the page (`onProductsPage: false`).
Directory-only entries can be retired or renamed products: check the product's AWS page before modelling it.

Azure and Google Cloud catalogues follow the same shape (`azure.*`, `gcp.*`) when their packs start.
