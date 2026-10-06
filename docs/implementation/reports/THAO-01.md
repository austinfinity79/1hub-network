# THAO-01

Global Navigation v2 — production closure of Thảo feedback #1 (Thảo §A, [SCREEN_ROUTE_MAP](../../demo-0710/SCREEN_ROUTE_MAP.md) "Navigation"). Milestone THAO-M1, branch `feat/thao-m1-public-experience`, worktree `../1hub-network-thao-m1`, base `origin/main` `d6bc04a`. Decisions: [DEC-THAO-NAV](../../decisions/DECISION_LOG.md#dec-thao-nav). No migration; not merged, not deployed.

## Nav impact map
| Item | Finding |
|---|---|
| Shared header | `src/components/public-shell/public-header.tsx` (+ `.module.css`): brand, 5 entries, 2 dropdowns, mobile panel, VI \| EN, account |
| Routes | `src/lib/public/routes.ts` `PUBLIC_ROUTES`: about `/about`, products `/products`; talents, programmes, events, news `null` |
| Pages on it | `/`, `/about`, `/products`, `/products/[slug]`, `/talents/[handle]` |
| Other headers | `/library` (L15 bar: "Thư viện", Chương trình, Sự kiện, Tin tức labels), `/organizations/[slug]` (page anchors), `/auth/*`, `/legal/*` (standalone flows); member / ops shells are not public |
| Language | none: `<html lang="vi">`, no i18n, no EN copy |
| Legacy in shared nav | none: no "Thư viện" / "Sự kiện" top-level, no product dropdown, no `#` / `javascript:` link |

## Route contract
| Entry | Class | Target |
|---|---|---|
| HUB mark | REAL_ROUTE | `/`, inline SVG, `aria-label` "HUB Network — trang chủ" |
| Giới thiệu ▾ | REAL_ROUTE + REAL_DROPDOWN_ACTION | `/about`; menu: Về HUB Network `/about`, iHUB Ventures, VNV, 1Hub (approved external) |
| Chương trình ▾ | REAL_DROPDOWN_ACTION | menu opens; both entries READ_ONLY_APPROVED (no public programme / event screen) |
| Sản phẩm | REAL_ROUTE | `/products` |
| Nhân tài | READ_ONLY_APPROVED | plain label (no `/talents` directory; only allow-listed founder pages exist) |
| Tin tức | READ_ONLY_APPROVED | plain label (no news screen supplied) |
| VI \| EN | READ_ONLY_APPROVED | VI current, EN unavailable |

## Changes
- **Menus close on a choice** (P1): the mobile panel stayed open when the current page's own link was chosen; after closing an in-flow dropdown on `mousedown` the next tap missed its link. Now any link in the panel or a dropdown closes it, Escape closes the panel, outside dismissal runs on `click`.
- **VI \| EN** semantics: `role="group"` "Ngôn ngữ", VI `aria-current`, EN `aria-disabled` with "Bản tiếng Anh — sắp có"; same text and look.
- New durable spec `tests/visual/specs/thao-01-global-nav.spec.ts` (9 tests).

## Verification
| Gate | Result |
|---|---|
| format · lint · typecheck · build · unit | PASS · PASS · PASS · PASS · 458 / 458 |
| THAO-01 spec + protected slice (demo-home-about-01, demo-dir2-01, demo-sp1-founder-01, demo-qa-vertical-flow, p0-shell-navigation, alpha-interaction-gaps, public-library) | 123 / 123 (8 specs), UAT 19 / 19 |
| Extra shell neighbours (m0-entry-01-root, s1-uat-02-feedback, internal-alpha-release, l5 + l6 in run order) | PASS (see debt) |
| Responsive 1440 / 768 / 390 × 5 pages | no overflow, panel and dropdown usable, labels ≥ 44 px, closes after a choice |
| Runtime | console / hydration 0, 5xx 0 |

## Exceptions / debt
- `/library` keeps its L15 header: replacing it changes the gated `A-header` block of the approved L15 baseline — REVIEW_REQUIRED_PO (adopt the shared header and re-approve that block, or keep).
- Nhân tài, Tin tức, Chương trình entries stay labels until their screens exist (no route invented).
- `l6-discovery-privacy` fails when run alone (needs the vocabulary fixture of an earlier spec); passes in run order — pre-existing test isolation debt.

## Related
- [DEMO-QA-01](DEMO-QA-01.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
