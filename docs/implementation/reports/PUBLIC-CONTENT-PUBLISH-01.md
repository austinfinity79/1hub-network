# PUBLIC-CONTENT-PUBLISH-01

The refreshed Thảo workbook (`1hub.network - Tổng hợp thông tin sprint 1 (1).xlsx`, sha256 `4b023eaf…`) and its Drive folders, bound to the public pages that already have a compatible slot. No DB change, no migration, no new media path: pictures are optimised WebP in `public/` (the About pipeline), logos use the public logo rule of DEMO-CONTENT-V2-PATCH-A. Provenance: [public-assets-provenance](../../demo-content/sprint1-v2/internal/public-assets-provenance.json).

## Binding audit
| Section | File | Source before | After |
|---|---|---|---|
| Ticker | `home-content.ts` `HOME_TICKER` | STATIC (DM01 frame) | the 4 refreshed programme names |
| Programme cards | `PROGRAMME_CARDS`, `home.tsx` | STATIC (DM01 sample) | 4 refreshed programmes: kind, status, description, host verbatim; covers 01–04; period / prize / scale omitted (empty in source) |
| Programme updates feed | `PROGRAMME_UPDATES` | STATIC | unchanged (no refreshed source) |
| Products: sectors, tiles, investor carousel | `home-data.ts`, `home-products.tsx` | DB (canonical) | + public logos; carousel = demo pitch (Tracely) then the sheet's 7 safe-set startups; fundraising chip only where recorded |
| News | `NEWS` | STATIC | text unchanged (sheet: "giữ nguyên"); pictures 01–03 |
| About milestones | `about-data.ts` | STATIC (S1-UAT-08A) | + "11 · 2025 Cột mốc thể chế" photo (was empty) |
| About people | `about-data.ts` | STATIC | + Phạm Thành Long, Lê Mai Anh (exact names); others already identical |
| About partners / chapters | `about.tsx` | STATIC placeholders / NO_SURFACE | held (no names or categories / no slot) |
| `/programmes` | DB | DB_DYNAMIC | unchanged: refreshed rows lack dates, lifecycle and host organisation |
| Event, Talent | — | — | HOLD (no dataset / no consent field) |

## Held, by rule
- 7th milestone and unlabelled milestone file; HUB Chapter (11 + cover) and HUB Business (17) logos; 8 org-chart people outside the About list; 2 non-exact names.
- Homepage programme cards are not clickable (unchanged); no programme record or route is created.
- The Kawai description ("lớn nhất miền Bắc…") is the owner's copy, kept verbatim.

## Verification
| Gate | Result |
|---|---|
| format · lint · typecheck · build · unit · DB | PASS · PASS · PASS · PASS · 466 / 466 · 885 / 885 |
| `public-content-publish` (new) | programmes, ticker, news, carousel order + no invented chip, logos, About, 5 widths |
| DM01 pixel | refreshed text marked `data-pixel="data"` (DEMO-D8 INTENTIONAL-DATA); frames, layout and footer still compared |
| Full regression (`b9342a4`) | 1419 tests: 1390 PASS · 29 SKIP (opt-in) · 0 FAIL · 0 FLAKY; UAT 19 / 19 |

## Related
- [DEMO-CONTENT-V2-PATCH-A](DEMO-CONTENT-V2-PATCH-A.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md) · [P0_STATUS](../P0_STATUS.md)
