# S2-PRODUCT-CATALOG-CLEANUP-01

Homepage + /products product presentation cleanup (Sprint 2, priority 02). One shared rule (`src/lib/public/product-detail.ts`) drives both pages.

| Change | Where | Result |
|---|---|---|
| Highlighted product | home investor carousel | "1Hub - Smart Campus Solution" first (canonical record: name, summary, Giáo dục, logo; no quarantined claim), then Tracely, then the featured list |
| Not real products | DB `projects.visibility` PUBLIC → PRIVATE for `agritrace`, `kho-lanh-mien-tay` (demo rows kept, audit +2) | gone from every public surface (home, /products, counts); their direct routes 404 like any private venture |
| /products hero | `components/products/directory.tsx` | "các sản phẩm trong mạng lưới"; the 3-number summary (gọi vốn / khách hàng trả phí / iHUB Ventures) removed, no replacement |
| Detail links | `DETAIL_PRODUCT_SLUGS = ['1hub-smart-campus-solution']` | /products: "Xem hồ sơ" only on Smart Campus (others keep Follow); home sector rows, tiles, carousel CTA: plain text / no CTA for others; direct routes unchanged |
| Logos | Drive `1yI0Fro6c3PKxZ5GTsvyFzvMZT5b5qjyH` (89 files) | 53 products bound (exact, case-insensitive file name = product name or slug; only products without a logo); 512 px WebP assets (owner sidecar) in the media volume, `logo_asset_id` + `metadata.logo_binding` (batch `s2-product-logos`), audit +53 |

## Not bound (for PO decision)
- `markat.png` and `Markat.png`: two different images for Markat — ambiguous, not bound.
- 34 files with no exact product match (near names only, e.g. `BUNNY WALLET` / BunnyWallet, `CareerUp` / Career Up, `zest aroma` / ZestAroma, `Saty` / SATY RICE FARM, `viétoil` / VietSoil): not guessed.
- Exact file-name match but different wording in the artwork: Dancemilling (logo reads "DANCESMART"), Website AI (logo reads "SUDO e-commerce") — bound by the rule, flagged for review.

## Tests
Targeted specs (thao-05, demo-home-about-01, thao-03-home, product-detail-smart-campus, thao-06, demo-sp1-founder-01, demo-dir2-01, public-content-publish, demo-qa-vertical-flow, hero-slider) updated to the detail-link rule and the hero wording; all pass except the known hero-counter typography (IBM Plex Mono 400).

## Related
- [PRODUCT-DETAIL-SMART-CAMPUS-01](PRODUCT-DETAIL-SMART-CAMPUS-01.md) · [S2-HOME-HIGHLIGHTS-ASSETS-01](S2-HOME-HIGHLIGHTS-ASSETS-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
