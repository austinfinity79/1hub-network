# WF05 UAT Matrix

Automated in `tests/visual/specs/wf05-uat-journey.spec.ts` (Playwright, UI-driven; HC-01 / 02 sign in through the real magic link and WF01 onboarding, then enter WF05 from MemberShell). Screen-level cases stay in each WF05-T00 / S0x spec. Step evidence: `tests/visual/reports/pixel-qa/WF05-UAT.{HC01,HC02,HC03,HC04,SEC,NAV,VIS}.json` and `tests/visual/actual/wf05-uat-*.png` (generated, not tracked).

Runs on 2026-09-27: the dev DB; the dev DB after an app + PostgreSQL restart; a fresh PostgreSQL (001→009 + seed). Every WF05 phase is bracketed by row-exact hashes of all 31 tables.

## HC-WF05-01 / 02 — PROJECT owner, STARTUP owner (same 13 steps each)
| ID | Case | Checked | PROJECT | STARTUP |
|---|---|---|---|---|
| HP-01 | Enter | Magic link → onboarding → `/me` → "Dự án & Startup · Demo" → S01: no venture, P1 only | PASS | PASS |
| HP-02 | Canonical venture | S01 "+ Tạo dự án / startup" → WF02 create → "← Tài khoản của tôi" | PASS | PASS |
| HP-03/04 | S01 → S02 | Row → detail; P1 eligible, "Đăng ký" | PASS | PASS |
| HP-05 | S02 → S03 | Applicant = the live venture, "Đăng ký với tư cách: Đội / Startup"; 2 questions; nothing stored | TEAM | STARTUP |
| HP-06/07 | Incomplete DRAFT, refresh | One DRAFT `[a, '']`; answers kept | PASS | PASS |
| HP-08 | S03 → S04 | "Rà soát & nộp" saves, opens S04; checklist green | PASS | PASS |
| HP-09/10 | Submit, refresh | DRAFT → SUBMITTED once; answers, `created_at` kept; read only after refresh | PASS | PASS |
| HP-11 | Post-submit | "← Hồ sơ dự án" → S02 "Đã nộp", no "Đăng ký" → S01 "Đã nộp" | PASS | PASS |
| HP-12 | S03 after submit | Locked, "Xem đơn đã nộp"; browser back | PASS | PASS |
| HP-13 | Data | Store = ids + answers; 1 canonical venture; tables written: 0 | PASS | PASS |

## HC-WF05-03 / 04 — canonical reuse, reset
| ID | Case | Result |
|---|---|---|
| CR-01..04 | DRAFT → S02 "Sửa hồ sơ" → WF02 rename → S01, S02, S03 applicant, S04 review show the new name; store byte-identical; one record per venture; 0 table writes | PASS |
| RS-01..03 | Reset after DRAFT (form afresh) and after SUBMITTED (S02 "Đăng ký" again); store empty; ventures, members, profiles, programmes, events and the programme list unchanged | PASS |

## SEC-WF05-01 — 8 actors × 4 routes + 2 APIs, plain and spoofed
Spoofed on every call: `x-role`, `x-organization-id`, `x-owner-profile-id`, `x-profile-id`, `x-account-id` headers; `owner_profile_id`, `profile_id`, `account_id`, `orgId`, `role`, `role_label` query. Spoofed result = plain result for every cell.

| Actor | S01 / S02 / S03 / S04 | API list / detail | Result |
|---|---|---|---|
| Guest | → `/auth` | 401 / 401 | PASS |
| Onboarding incomplete | → resolver step | 403 / 403 | PASS |
| Owner | 200 all | 200 / 200 (`OWNER`) | PASS |
| ACTIVE member, label "Founder" | 200 all; S03 locked; S04 no submit (planted draft: owner ✗) | 200 / 200 (`MEMBER`, `NOT_OWNER`) | PASS |
| Pending invitee | 200 / 404 / 404 / 404 | 200 (not listed) / 404 | PASS |
| Unrelated member | 200 / 404 / 404 / 404 | 200 (not listed) / 404 | PASS |
| Platform admin | 200 / 404 / 404 / 404 | 200 (not listed) / 404 | PASS |
| HUB leader | 200 / 404 / 404 / 404 | 200 (not listed) / 404 | PASS |

POST / PUT / PATCH / DELETE on both APIs: 405. No email, account or profile id of any actor in any unspoofed response.

## NEG-WF05 — negative / alternate
| # | Case | Where | Result |
|---|---|---|---|
| 1–8 | Guest, incomplete onboarding, owner, ACTIVE member, pending invite, unrelated, admin and leader on another member's venture | SEC-WF05-01; T00, S01–S04 specs | PASS |
| 9–12 | Foreign venture, foreign / DRAFT / random programme, random UUID, malformed id | NEG ids; S02–S04 specs | 404 |
| 13–17 | `owner_profile_id`, `profile_id`, `account_id`, `orgId`, `x-role` spoof | SEC-WF05-01; S03 / S04 specs | No effect |
| 18 | Route-id swap after a valid S04 load; a planted foreign draft | NEG ids; S04 spec 24 | 404; never used |
| 19 | ARCHIVED venture | NEG lifecycle; S02 / S03 / S04 specs (incl. archived after load) | No "Đăng ký", locked, blocked |
| 20 | DRAFT programme (C1) | NEG ids; S01–S04 specs | Not listed; 404 |
| 21 | Existing SUBMITTED | NEG lifecycle; S03 21, S04 14 | Read only, no second application |
| 22 / 23 | Duplicate start / duplicate save | NEG lifecycle; S03 spec | One application |
| 24 | Rapid / double submit | NEG lifecycle; S04 14–17 | One transition |
| 25 / 26 | Missing required answer / invalid answer (> 2000) | NEG lifecycle; S03 19, S04 7–9 | Blocked; DRAFT unchanged |
| 27 / 28 | Reset after DRAFT / after SUBMITTED | HC-WF05-04; S03 19, S04 26 | Cleared; canonical unchanged |
| 29 | A form opened as DRAFT after the application was submitted | NEG lifecycle | Save refused; SUBMITTED never returns to DRAFT |

## STORE-WF05 and NAV / VIS / COPY
| ID | Checked | Result |
|---|---|---|
| STORE-WF05 | Refresh; resume via S01 → S02 "Tiếp tục"; a new clean browser session holds nothing; one key per actor, one entry per pair; T00 field names only; no venture / programme copy, PII, cookie value or token; nothing in `localStorage`; refused write on save and on submit changes nothing; submit keeps answers and `created_at` | PASS |
| NAV-WF05 | 14 page visits (owner: 10 route states incl. archived and SUBMITTED; member: 4) → 18 unique links, 0 dead; no `#`, `javascript:`, `/dev`, placeholder or future route; forward S01 → S04 by clicks, back and direct refresh at every step | PASS |
| VIS-WF05 | 11 states × 1440 / 768 / 390: 0 overflow, key action reachable; 1440: typography 442 elements, 0 violations; shell + header rule 33 segments ≤ 0.00025 | PASS |
| COPY-WF05 | Visible text of all 33 captures: no technical term (fixture, mock, sessionStorage, DTO, canonical, enum, id names, API) and no unsupported outcome (approved, accepted, under review, matched, recommended, đã duyệt, đang xem xét, …) | PASS |

## Related
- [reports/WF05_COMPLETION_AUDIT.md](reports/WF05_COMPLETION_AUDIT.md) — audit and verdict
- [WF05_HAPPY_PATH_PLAN.md](WF05_HAPPY_PATH_PLAN.md) — journeys and negative matrix
- [WF04_UAT_MATRIX.md](WF04_UAT_MATRIX.md) — WF04 precedent
