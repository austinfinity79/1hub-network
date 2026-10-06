# THAO-01-FIX

Closes the two Global Navigation v2 deviations left by [THAO-01](THAO-01.md).

- Branch / worktree: `feat/thao-m1-public-experience` / `../1hub-network-thao-m1`
- Base: `1e95334`
- Decisions: [DEC-THAO-NAV](../../decisions/DECISION_LOG.md#dec-thao-nav) D1 and D4 amended, D5 added
- No migration; not merged, not deployed.

## Changes
| Deviation | Fix |
|---|---|
| Giới thiệu was a dropdown (frames draw ▾) | Direct link to `/about`. Only Chương trình keeps a menu. iHUB Ventures, VNV and 1Hub stay reachable from the footer; no page or route removed |
| `/library` rendered its own L15 bar ("Thư viện", Chương trình, Sự kiện, Tin tức) | Renders `PublicHeader` (guest / member state from `publicViewer`). The 101 px slot is kept, so the hero and everything below stay where L15 places them. Library data, tabs, search and cards unchanged |
| "VI \| EN" read "VI\|EN" in the mobile panel (THAO-01's semantic markup in a flex row) | Separator is its own element and the mobile row keeps a 0.3 em gap; desktop unchanged |
| Orphans of that change | `LibraryHeader` and its CSS (`.bar`, `.brand`, `.nav`, `.navActive`, `.barRight`, `.lang`, `.login`) removed. `src/components/landing/landing-parts.tsx` and `landing.module.css`, whose last user was the Library header, removed |

## Route contract after the fix
| Entry | Class | Target |
|---|---|---|
| Giới thiệu | REAL_ROUTE | `/about` |
| Chương trình ▾ | REAL_DROPDOWN_ACTION | 2 READ_ONLY_APPROVED entries |
| Sản phẩm | REAL_ROUTE | `/products` |
| Nhân tài, Tin tức | READ_ONLY_APPROVED | plain labels |

`GLOBAL_NAV_SINGLE_SOURCE = YES` for every public page: Home, About, Library, Sản phẩm, Startup, Founder. Not global navs: the `/organizations/[slug]` in-page anchors, `/auth/*`, `/legal/*`.

## Tests
- **thao-01-global-nav:** `/library` added to every shell check. New test: only Chương trình has a menu, Giới thiệu is a direct link (aria-current on `/about`).
- **public-library:** the header test now asserts the shared header (no "Thư viện" nav, nothing current). L15 block A-header is no longer compared; the reason is recorded as intentional. The other L15 blocks are still gated at dy 0.
- **demo-home-about-01:** the About menu assertion became "no Giới thiệu menu". The DM01 / DM02 pixel audit excludes the nav row: the frames draw "Giới thiệu ▾", and without the chevron the entries shift. This is INTENTIONAL. DM02 header block before the exclusion: 0.50 / 2.0008 %; after: 0.48 / 1.97 %.

## Verification
| Gate | Result |
|---|---|
| format · lint · typecheck · build · unit | PASS · PASS · PASS · PASS · 458 / 458 |
| Targeted + protected slice (thao-01, demo-home-about-01, public-library, wf06 ×4, demo-dir2-01, demo-sp1-founder-01, demo-qa-vertical-flow, p0-shell-navigation, alpha-interaction-gaps, l5, l6, s1-uat-02-feedback, m0-entry-01-root) | 16 specs: 187 + DM02 after the fix, 0 unexpected, 2 skipped (existing wf06 conditional), 0 flaky |
| Final rerun after the VI \| EN fix (thao-01, demo-home-about-01, public-library, demo-dir2-01, demo-sp1-founder-01, demo-qa-vertical-flow, p0-shell-navigation, alpha-interaction-gaps) | 8 specs, 123 / 123, 0 flaky |
| UAT L1–L2 | 19 / 19 |
| Runtime | console / hydration 0, 5xx 0 |

## Related
- [THAO-01](THAO-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
