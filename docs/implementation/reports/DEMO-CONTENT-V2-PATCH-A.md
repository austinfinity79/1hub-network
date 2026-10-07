# DEMO-CONTENT-V2-PATCH-A

Demo content v2 for the isolated demo database `hubnetwork_demo_0710`: the 93-card v1 catalogue batch patched to the refreshed workbook (92 safe), the 7 refreshed Product logos made public, and the locked PO sector decisions. Data runs: DEMO-CONTENT-IMPORT-A → V2-PATCH-A → FIX v0.1 → final closure. Manifest: [v2-patch-manifest](../../demo-content/sprint1-v2/v2-patch-manifest.md).

## Runtime (only code change)
| File | Change |
|---|---|
| `src/lib/media/public-logo.ts` | `isPublicProductLogo`: an asset is public while it is the `logo_asset_id` of a STARTUP · ACTIVE · PUBLIC venture |
| `src/app/media/assets/[id]/route.ts` | that rule first (guests included, `public, max-age=300`); every other asset keeps the session rules |
| `src/lib/public/directory-data.ts` | `logo` (`/media/assets/:id` or null) on directory and startup rows |
| `directory.tsx`, `startup-frame.tsx`, 2 stylesheets | the logo in the existing tile, initials when none |

No migration, no schema, no new DOMAIN. Homepage does not read the field (unchanged).

## Data (demo database only)
| Step | Result |
|---|---|
| v1 import | 93 cards, owner = technical account `hub-network-catalogue@catalogue.invalid` (DEACTIVATED, PRIVATE, no login) |
| v2 patch | VNSPECIAL ARCHIVED (tombstone), 7 updated, 85 unchanged → 92 listed (+3 demo = 95) |
| Logos | 7 EXACT (workbook cell → Drive file, size + sha256 verified) bound in the media store |
| Sectors (PO) | Smart Campus → `edtech` "Giáo dục"; Drippy INTENTIONALLY_UNMAPPED_P0 |

Every step: guarded target, backup first, dry-run, one transaction with a Tracely / technical owner / M3 snapshot check, idempotent second run, reverse mode.

## Tooling
`scripts/content-prep/` (v1 / v2 pack generators, domain audit) · `scripts/content-import/` (`import-products.mjs`, `patch-products-v2.mjs`, `bind-product-logos.mjs`).

## Verification
| Gate | Result |
|---|---|
| format · lint · typecheck · build | PASS |
| unit · DB | 466 / 466 · 885 / 885 (incl. `public-logo.db-test`) |
| Full regression (integration commit `bc894d0`) | 1410 tests: 1381 PASS · 29 SKIP (opt-in) · 0 FAIL · 0 FLAKY; UAT 19 / 19 |
| Live smoke | 7 / 7 logos served to guests and drawn on card + page; private assets 404 for guest / member; Tracely → founder unchanged |

## Related
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md) · [P0_STATUS](../P0_STATUS.md) · [THAO-M3-QA-01](THAO-M3-QA-01.md)
