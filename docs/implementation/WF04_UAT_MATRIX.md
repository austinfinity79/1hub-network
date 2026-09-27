# WF04 UAT Matrix

Automated in `tests/visual/specs/wf04-uat-journey.spec.ts` (Playwright, 1440×900 DPR1, UI-driven; J1 / J2 sign in through the real magic link). Screen-level cases stay in each WF04-S0x spec. Step evidence: `tests/visual/reports/pixel-qa/WF04-UAT.J{1,2,3}.json` and `tests/visual/actual/wf04-uat-*.png` (generated, not tracked).

Runs on 2026-09-27: the dev DB; the dev DB after an app + PostgreSQL restart; a fresh PostgreSQL (001→009 + seed).

## UAT-WF04-J1 — Programme (Chapter 01 leader)
| ID | Case | Checked | Result |
|---|---|---|---|
| HP-P01 | Enter the demo | Magic link → `/ops/network` → OpsShell "Chương trình & Challenge" → S01, 2 fixture rows | PASS |
| HP-P02..P04 | Create PROGRAMME, basic info, continue | S02: type, name, summary, dates; owner Chapter 01 from scope → S03 with "Đã tạo bản nháp “…”."; session DRAFT; no Bài toán | PASS |
| HP-P05 | Stages | 3 added, 1 edited, moved up then down | PASS |
| HP-P06/P07 | Events | S03 → S04; 2 added, 1 edited, 1 removed; `programme_id` = the draft | PASS |
| HP-P08/P09 | Registration | S04 → S05 empty → Cá nhân + Đội, 1 question, saved | PASS |
| HP-P10/P11 | Team | S05 → S06; empty, no input or management control | PASS |
| HP-P12/P13 | Review | S06 → S07; 4 PROGRAMME items "Đạt"; no Bài toán item | PASS |
| HP-P14..P16 | Publish | DRAFT → PUBLISHED once → S08 with "Đã xuất bản “…”." | PASS |
| HP-P17 | Detail summaries | Overview, 3 stages with dates, 1 event, registration, team; no Bài toán card | PASS |
| HP-P18/P19 | Refresh | PUBLISHED and the same summaries; the one-off message is gone | PASS |
| HP-P20/P21 | List | "← Danh sách" → 3 rows; the new row "Đang công khai" | PASS |
| HP-P22/P23 | Reset | Draft gone, P1 PUBLISHED, C1 DRAFT, store empty; 16 canonical tables unchanged | PASS |

## UAT-WF04-J2 — Challenge (platform admin, owner Chapter 01)
| ID | Case | Checked | Result |
|---|---|---|---|
| HP-C01/C02 | Create CHALLENGE, basic info | Owner chosen from the admin's list | PASS |
| HP-C03..C05 | Journey, Bài toán | Bài toán section only for CHALLENGE; 2 added, 1 edited, both removed | PASS |
| HP-C06..C08 | Events, registration, team | 1 event, Startup, read-only team | PASS |
| HP-C09/C10 | Review blocked | `problems` "Còn thiếu"; "Còn thiếu 1 mục"; publish disabled; DRAFT | PASS |
| HP-C11 | Satisfy | Checklist "Sửa" → S03; 1 Bài toán → "Sẵn sàng xuất bản" | PASS |
| HP-C12..C14 | Publish, detail | S07 → S08 PUBLISHED; Bài toán card "1 bài toán" | PASS |
| HP-C15/C16 | Refresh, reset | Kept; reset removes the draft; tables unchanged | PASS |

## UAT-WF04-J3 — Keep a draft (leader)
S02 → S03 (1 stage) → leave S04 with an unsaved editor → S01 row "Bản nháp" → S08 shows the saved stage and no unsaved event → "Quản lý" resumes S03 → reset: **PASS**.

## SEC-WF04-01 — 6 actors × 16 pages + 3 APIs (spoofed `x-role`, `x-organization-id`, `?orgId`, `?role`)
| Actor | Pages | API list / detail | Result |
|---|---|---|---|
| Guest | → `/auth` | 401 / 401 | PASS |
| Member (ACTIVE Chapter 01 membership) | 404 | 403 / 404 | PASS |
| PROGRAMME_ORGANIZER label only | 404 | 403 / 404 | PASS |
| Foreign leader (Chapter 02) | list, new 200; fixture routes 404 | 200 `items: []` / 404 | PASS |
| Leader (Chapter 01) | 200 | 200 (2 items) / 200 | PASS |
| Platform admin | 200 | 200 (2 items) / 200 | PASS |

No POST / PUT / PATCH / DELETE on the demo API (≥ 400). Leadership title + label alone: 403 / 404. No email, session or account / profile id in any response. 16 tables unchanged.

## NEG-WF04 — negative / alternate
| # | Case | Where | Result |
|---|---|---|---|
| 1–9 | Guest, member, foreign org, foreign programme, malformed id, random UUID, orgId / x-role / label spoof | SEC-WF04-01; T00, S01–S08 specs | PASS |
| 10 / 11 | Invalid type; invalid applicant type (controlled vocabulary) | NEG-10/11; S02, S05 specs | PASS |
| 12 / 14 / 15 | Invalid stage; event end before start; blank question | NEG-12/14/15; S03–S05 specs | PASS |
| 13 | Event for another programme (planted `programme_id`) | NEG-13; S04 spec | PASS |
| 16 / 17 | Incomplete publish; double publish | NEG-16/17, J2; S07 spec | PASS |
| 18 | Direct load + refresh on all 9 routes (P1, C1, a session draft) | NEG-18 | PASS |
| 19 | Reset with open editors / a pending retry / an open draft | NEG-19 (WF04-P2-01 fix) | PASS |
| 20 | `/programmes*`, `/challenges`, unbuilt `/demo/*` → 404; no public link | NEG-20; S08 spec | PASS |

## Navigation, Event boundary, visual
| ID | Checked | Result |
|---|---|---|
| NAV-WF04 | Every link on the 9 routes of a session draft → a built screen (200, no missing state); no `#`, no inert control, no placeholder text; back at every step; S02 "Huỷ"; S01 row → S08 | PASS |
| EVT-WF04 | Demo events only in the session, `programme_id` = their programme; no `events` row; WF03 rows unchanged; ops list, `/api/v1/events/:id`, ops PATCH, S07 ops page and the public page never show them | PASS |
| VIS-WF04 | 11 screens at 1440×900: typography, ADM5 header band / rule; 768 / 390: no overflow, key action reachable | PASS |

## Related
- [reports/WF04_COMPLETION_AUDIT.md](reports/WF04_COMPLETION_AUDIT.md) — audit and verdict
- [WF04_HAPPY_PATH_PLAN.md](WF04_HAPPY_PATH_PLAN.md) — journeys J1–J3
- [WF03_UAT_MATRIX.md](WF03_UAT_MATRIX.md) — WF03 precedent
