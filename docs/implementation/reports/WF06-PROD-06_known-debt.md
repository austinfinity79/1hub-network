# WF06-PROD-06_known-debt

**Known debt and pre-promotion items at WF06 closure** (evidence 19, 20). Parent: [WF06-PROD-06_production-readiness.md](WF06-PROD-06_production-readiness.md). Nothing here was fixed in this task (no unrelated product change, no redesign, no baseline image changed).

## Pre-promotion (P1_PRE_PROMOTION = 2)
| # | Item | Why before promotion | Owner |
|---|---|---|---|
| P1-1 | external category → DOMAIN slug map (`external-domain-map.ts`) checked against the production DOMAIN vocabulary | without matching slugs the Startup / founder quick chips stay hidden and external records carry no domain facet (inert, never wrong) | HUB / PO |
| P1-2 | guest founder sign-in copy ("Đăng nhập để xem nhà sáng lập" …) | new copy on L15c in the existing block style | PO / design |
| — | WF45-PROMO-01 (WF04 / WF05 pre-promotion gate) | separate gate; this branch carries WF04 / WF05 | PO |

## P2 debt (P2_DEBT = 6)
| # | Item | Class | Proof |
|---|---|---|---|
| P2-1 | Library tab bar wider than 320 px (a tab lies outside the viewport) | KNOWN_BASELINE_DEBT (Library, L15) | same on `5199e07`; CSS unchanged by WF06 |
| P2-2 | `--muted` `#8e7677` on white = 3.65:1 for 14 px text (error / sign-in body text, facet note) | KNOWN_BASELINE_DEBT (design token) | token since 28/09; same on the pre-WF06 error block |
| P2-3 | M0-T11 runner: 13 corrected screens fail its legacy font allowlist, 4 its pre-revision sizes | TEST_BASELINE_STALE / PRE_EXISTING_BASELINE_DEBT | identical 17 failures on `5199e07` and `9733bf3`; revision harness passes |
| P2-4 | no rate limit on public reads | platform gap G14 | bounded pages, keyword and filters instead |
| P2-5 | canonical Library read capped at 1000 rows (warning logged at the cap) | scale debt | move paging into SQL before the cap matters (PROD-02 index audit) |
| P2-6 | Startup pixel / functional runs read the live external feed | test determinism | a fixed feed (as in PROD-05) for future pixel baselines |

## Accepted baseline and out of scope
| Item | Class |
|---|---|
| "Chưa xác định" no longer a stage facet (the API filters by VENTURE_STAGE id; contract: no unsupported chip) | ACCEPTED_BASELINE |
| facet values = the DOMAIN / VENTURE_STAGE vocabulary; canonical cards without member line or website; mark tones from opaque keys | ACCEPTED_BASELINE (DEC-W6P-D02 / D04) |
| homepage header "Tạo tài khoản" partly outside 320 px | OUT_OF_SCOPE (shared landing, same on `5199e07`) |
| member-shell mobile lane `a957876`, library layout lane `c1b60c3` | OUT_OF_SCOPE (separate lanes, not in HEAD) |

## Related
- [WF06-PROD-06_visual-closure.md](WF06-PROD-06_visual-closure.md) · [WF06-PROD-05_prod06-handoff.md](WF06-PROD-05_prod06-handoff.md)
