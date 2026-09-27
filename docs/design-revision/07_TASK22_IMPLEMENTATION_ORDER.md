# Task22 Implementation Order

**Bucket A only**, after the PO freezes this audit and accepts the conservative defaults. Before Task 22 starts, the approved frames are copied into `design-reference/` as the new pixel baseline (PO-approved subset only). Protected-workflow rules apply: targeted regression per batch, then a full regression, a release freeze and a redeploy.

## Batches
| Batch | Screens | Routes | Components | Business / API / data impact | Pixel baseline | Regression scope | Blockers |
|---|---|---|---|---|---|---|---|
| **22.1** Homepage | H1 | `/` (KEEP; already public) | Public header / footer, hero with search visual (non-functional unless HD-01), journey strip, audience blocks, event rows (static or omitted), stats, CTA policy | None. Only real destinations; placeholder blocks omitted | `Homepage.png` minus omitted blocks | P0-LANDING, P0-SHELL (wordmark, header), console / hydration, responsive | HD-01 default; real content for kept claims |
| **22.2** Auth + completion (WF01) | AUTH1–AUTH4, ACC-10 | `/auth`, `/auth/check-email`, `/auth/callback`, `/auth/error`, `/onboarding/complete` | Auth split layout, auth card, state boards, completion cards | None (copy and layout; consent step untouched) | AUTH1–4 replace WF01-S01…S04; ACC-10 replaces S08 (subset) | WF01 full (auth, onboarding, resume), SEC-OBS-01 referrer, auth-session | PO confirms the dropped rate-limit / support text |
| **22.3** Member / venture (WF02) | L11 ME0 (subset), L13a–c PRJ1–3 (subset) | `/me/settings` (+ `/me/privacy`), `/projects/new` | Settings overview cards, 3-step wizard over the existing create + email-invite APIs | None (existing APIs) | L11, L13a–c (subset) | WF02 full, P0-SHELL | — |
| **22.4** Chapter (WF03) | L19, L20, L23, L26 (subsets) | `/organizations/[slug]`, `/ops/org/:id`, `…/events`, `…/members` | Public org hero / CLB / event cards; ops KPI cards; event chips / rows; members tabs + inline approve / reject | None (existing data and actions) | L19, L20, L23, L26 (subset) | WF03 full, REL-SEC matrix, IA-P2-03 pointer reachability | HD-08 default (no KPIs / leadership) |
| **22.5** L4 | — | — | — | — | — | WF04 demo unchanged | L28 only if HD-10 promotes it |
| **22.6** L5 | — | — | — | — | — | WF05 unchanged | HD-06 / HD-07 |
| **22.7** L6 subset | L54 (404 / 500) | Next 404 + new `error.tsx` | State cards | None (UI for existing failures; closes IA-P3-05) | L54 (two states) | Console health, shell | — |
| **22.8** Consolidation | Shared primitives touched by 22.1–22.7; the shell model decided under HD-11 | — | Tokens unchanged (already `#fc523c` / `#160002` / `#efefef`); typography assertions | — | All above | **Full suite** + pixel audit + protected regression → release freeze → redeploy | — |

**HD-12 CLOSED** ([DEC-HD-12](../decisions/DECISION_LOG.md#dec-hd-12)): Space Grotesk on revision screens. **22.1 DONE** ([report](../implementation/reports/TASK-22.1_public-homepage.md)); its baseline is `design-reference/final/revision/H1`.

Order: 22.1 → 22.2 → 22.3 → 22.4 → 22.7 → 22.8. Batches 22.5 and 22.6 stay empty until B decisions are made. Each batch stops for review, per protected-workflow practice.

## Test Pack impact (baseline `docs/uat/`, commit `2d19cad`; the prompt's `2d19ca0` is the same commit; update only after the revised UI is redeployed GREEN)
| Test Pack item | Change | Status |
|---|---|---|
| Test actors, accounts, reset rules | Unchanged by Bucket A | NO CHANGE |
| WF-TEST-01 guest-auth | Homepage labels and CTAs ("Đăng nhập", "Tạo tài khoản", header items); auth copy ("Đăng nhập", "Gửi liên kết đăng nhập", "Kiểm tra hòm thư của bạn", "Liên kết không còn hiệu lực") | UPDATE AFTER TASK 22 (labels, CTA, expected results) |
| WF-TEST-02 onboarding | Completion copy ("Hồ sơ của bạn đã sẵn sàng"); steps unchanged unless HD-02 | UPDATE AFTER TASK 22 (label, expected result) |
| WF-TEST-03 member / ventures | Settings layout; project creation becomes a 3-step wizard (invite inside step 2) | UPDATE AFTER TASK 22 (screen order, labels) |
| WF-TEST-04 leader operations | Dashboard, events chips, members tabs with inline approve | UPDATE AFTER TASK 22 (labels, steps) |
| WF-TEST-05 / 06 demos | Unchanged unless HD-06 / HD-07 / HD-10 | NO CHANGE |
| Routes | No route change in Bucket A | NO CHANGE |
| Screenshots | All revised screens | UPDATE AFTER TASK 22 |

## Related
- [06_SCOPE_BUCKETS.md](06_SCOPE_BUCKETS.md) · [05_BUSINESS_API_DATA_CONFLICT_MATRIX.md](05_BUSINESS_API_DATA_CONFLICT_MATRIX.md)
- [../uat/INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md](../uat/INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md) — baseline Test Pack
