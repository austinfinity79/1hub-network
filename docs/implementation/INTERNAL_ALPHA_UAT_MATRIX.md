# Internal Alpha UAT Matrix

Automated evidence for the Internal Alpha release gate. Cross-workflow cases: `tests/visual/specs/internal-alpha-release.spec.ts` (REL-AUTH, REL-SEC, REL-NAV, REL-RESP, REL-DATA; reports `tests/visual/reports/pixel-qa/IA-REL.*.json`). Workflow journeys stay in each workflow's closure spec. Runs on 2026-09-27: the dev DB, a fresh PostgreSQL (001→009 + seed), and the dev DB after an app + PostgreSQL restart. Counts: full suite 664 tests (P0-LANDING 8, P0-SHELL + shell routes 47, WF01 152, WF02 94, WF03 66, WF04 115, WF05 66, shared 110, Internal Alpha 6); dev DB after the fix 640 passed / 24 skipped / 0 failed.

## Happy paths (UI-driven, magic link where marked)
| Journey | Spec / cases | Result |
|---|---|---|
| Landing → auth → magic link → onboarding S05–S08 → `/me` | `wf01-uat-journey` UAT-01..13 (magic link); `p0-shell-navigation` "landing → auth → magic link → onboarding → complete → project" | PASS |
| Landing for guest / member (CTA, sections, legal, responsive, keyboard) | `p0-landing` 1–10 | PASS |
| Member profile, privacy, roles, venture create / edit, team invite / accept, settings, sessions, deletion request | `wf02-uat-journey` HC-WF02-01..12 (new account) | PASS |
| Chapter leader: request → review → leadership → profile → hierarchy → event → public page | `wf03-uat-journey` UAT-WF03-J1 | PASS |
| Programme (J1), Challenge (J2), keep a draft (J3) | `wf04-uat-journey` (magic link) | PASS |
| PROJECT → TEAM and STARTUP → STARTUP application, WF02 rename seen in WF05, reset | `wf05-uat-journey` HC-WF05-01..04 (magic link) | PASS |
| Shell: member ↔ ops entry, admin context switch, logout, revoked session, 404 | `p0-shell-navigation` | PASS |

## Security / negative (consolidated)
| Case | Evidence | Result |
|---|---|---|
| Actor matrix: guest, onboarding-incomplete, member (STARTUP owner), PROJECT owner, ACTIVE team member ("Founder" label), pending invitee + Chapter 01 leader + WF04 operator, platform admin, pending-membership member, unrelated member × 22 pages + 8 APIs | REL-SEC (270 cells, plain = spoofed for every cell) | PASS |
| Guest | every protected page → `/auth`; every API 401 | PASS |
| Incomplete onboarding | every member / ops / demo page → `/onboarding/purpose`; ops / demo APIs 403 | PASS |
| IDOR / foreign / random / malformed ids | REL-SEC (venture 404 for non-relations incl. admin, leader, invitee); WF02 ALT-04; SEC-WF03-01; WF04 SEC / NEG; WF05 NEG ids | PASS |
| Scope / role / org / profile / account spoof (`x-role`, `x-organization-id`, `x-*-id`, `orgId`, `role`, `owner_profile_id`, `profile_id`, `account_id`, `role_label`) | REL-SEC; SEC-WF03-01; SEC-WF04-01; SEC-WF05-01 | No effect |
| Cross-org | leader: Chapter 01 200, Chapter 02 page 404 / API 403; admin: both | PASS |
| Cross-project | owner / member of one venture: 404 on another; the invitee sees only the team page (DEC-WF02-S06-G2) | PASS |
| Invalid lifecycle / duplicate / concurrent mutation | WF01 UAT-09; WF02 ALT-05 / 06, S06 revoke concurrency; WF03 NEG; WF04 NEG-16 / 17; WF05 NEG lifecycle, double submit | PASS |
| Magic link: one-time, invalid, expired | REL-AUTH; WF01 UAT-04; `wf01-s03-auth-callback`; WF02 ALT-03 | PASS |
| Callback `Referrer-Policy: no-referrer`; no token in HTML / responses | REL-AUTH; `sec-obs-01-referrer` | PASS |
| Sessions list, revoke one / current / all, logout, revoked cookie replay | REL-AUTH; `wf02-s07-settings`; `auth-session`; `p0-shell-navigation` | PASS |
| Malformed `X-Forwarded-For` on `POST /auth/magic-link` (IA-P2-01, fixed) | REL-AUTH forwarded address | 202; only a plain IP stored |

## Navigation, responsive, data
| ID | Checked | Result |
|---|---|---|
| REL-NAV | Crawl as guest, member, leader, admin: 108 page visits, 35 route patterns, 102 link targets; 0 non-200, 0 `#` / `javascript:` / empty href, 0 `/dev` link, 0 future (WF06) route, 0 placeholder, 0 technical copy; storage without email, token or cookie value. Seed text marking itself "Fixture" on 8 route patterns (data, not copy) | PASS |
| P0-SHELL matrix | 536 rows, 0 dead | PASS |
| REL-RESP | 9 screens × 1440 / 768 / 390: 1440 all clean; landing, auth, WF05 clean at 768 / 390; app shells desktop-first (see audit) | PASS (certified scope) |
| Hydration #418 | Audit: **1 occurrence**, fresh-DB full run, `p0-shell-navigation` "landing and auth entry …" (second `/` load at 768 px). Remediation ([IA-P2-02](reports/IA-P2-02_hydration-418.md)): deterministic repro by pausing the landing stream after the page-root RSC chunk 42 / 150 → 0 / 150 with the React backport patch; affected tests 50 / 50 each (fresh server) and 25 / 25 each (fresh DB), 0 #418; full regression on a fresh DB 640 passed / 24 skipped / 0 failed, 0 #418 | **CLOSED — IA-P2-02 fixed**; recheck in the final audit |
| REL-DATA | 1 profile per account (unique `account_id`), no orphan profile; membership / leadership / roles / consent / visibility separate tables; no stored completion percent; no application / founder / investor / matching table | PASS |

## Related
- [INTERNAL_ALPHA_COMPLETION_AUDIT.md](INTERNAL_ALPHA_COMPLETION_AUDIT.md) — audit and verdict
- [INTERNAL_ALPHA_RELEASE_MANIFEST.md](INTERNAL_ALPHA_RELEASE_MANIFEST.md) — release manifest
- [WF05_UAT_MATRIX.md](WF05_UAT_MATRIX.md), [WF04_UAT_MATRIX.md](WF04_UAT_MATRIX.md) — workflow matrices
