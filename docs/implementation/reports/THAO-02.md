# THAO-02

Footer v2 — production closure of Thảo feedback #2 (Thảo §A "Footer").

- Milestone: THAO-M1
- Branch / worktree: `feat/thao-m1-public-experience` / `../1hub-network-thao-m1`
- Base: `c0965e1`
- Decisions: [DEC-THAO-FOOT](../../decisions/DECISION_LOG.md#dec-thao-foot)
- No migration; not merged, not deployed.

## Starting point
The shared `PublicFooter` already had the two link columns, but it closed only Home and About. Library, Sản phẩm, Startup and Founder ended without a footer, because their frames (L15, DM08, DM10, DM13) draw none.

## Changes
| Change | Detail |
|---|---|
| Coverage | `PublicFooter` added below the content of `/library`, `/products`, `/products/[slug]` and `/talents/[handle]` (`home` variant, legal links from `publicShellData`). Content above is unchanged |
| Library data | `/library` now reads `publicShellData()` (viewer + current legal documents) instead of `publicViewer` |
| Tests | New `thao-02-footer.spec.ts` (6 tests) |
| Test updates | `demo-sp1-founder-01`: the contact-row privacy check now reads `<main>`, because the footer's public newsletter field says "Email của bạn"; ids, `@example.test`, `mailto:` and application words are still checked on the whole page. `public-library`: the Library content must end at the L15 page end (2470 px), where the footer now starts |

## Contract
| Column | Entry | Class | Target |
|---|---|---|---|
| 1 | Giới thiệu | REAL_ROUTE | `/about` |
| 1 | iHUB Ventures | EXTERNAL | `https://deck.ihub.ventures/` (200, gated → `/login`) |
| 1 | VNV | EXTERNAL | `https://vnv.ihub.ventures/` (200, gated → `/access`) |
| 1 | 1Hub | EXTERNAL | `https://1hub.global/en` (200) |
| 2 | Sản phẩm | REAL_ROUTE | `/products` |
| 2 | Chương trình, Nhân tài, Tin tức | READ_ONLY_APPROVED | plain labels |
| bottom | Điều khoản · Quyền riêng tư | REAL_ROUTE | current legal documents (200) |

External links open in a new tab (`noopener noreferrer`). The newsletter field is disabled and the button `aria-disabled`.

## Verification
| Gate | Result |
|---|---|
| format · lint · typecheck · build | PASS |
| thao-02-footer | 6 / 6 |
| Coverage, 6 pages | 1 footer, 2 columns, exact entries, no button / menu / dead link |
| Keyboard | Tab walks Giới thiệu → iHUB Ventures → VNV → 1Hub → Sản phẩm → legal; labels and the inert form are skipped |
| Responsive | 1440 / 768: columns share a row. 390: column 2 below column 1. No overflow, nothing clipped |
| Protected slice (thao-01, demo-home-about-01, public-library, wf06 ×4, demo-dir2-01, demo-sp1-founder-01, demo-qa-vertical-flow, p0-shell-navigation, alpha-interaction-gaps, s1-uat-02-feedback, m0-entry-01-root) | 15 specs, 179 tests: 177 PASS, 2 skipped (existing wf06 conditional), 0 FAIL, 0 FLAKY (after the 5 assertions that assumed no footer were updated) |
| UAT L1–L2 | 19 / 19 |
| Runtime | console / hydration 0, 5xx 0 |

## Related
- [THAO-01](THAO-01.md) · [THAO-01-FIX](THAO-01-FIX.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
