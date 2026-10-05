# Readiness gaps

What stands between today and a PASS of S1-UAT-09B (Sprint 1 UAT readiness). Counts from [traceability.csv](traceability.csv).

## Gap report

| Bucket | AC |
|---|---|
| READY_NOW | 62 |
| PENDING_IMPLEMENTATION | 78 (unassigned 26 · S1-UAT-07 21 · S1-UAT-06 15 · S1-UAT-03 13 · S1-UAT-03B 10 · S1-UAT-04 2 · S1-UAT-01 1; shared AC counted once in the total) |
| BUSINESS_BLOCKED | 2 (Q1 Library member card, Q2 verified-fund view) |
| LEGAL_BLOCKED | 11 (LEGAL-AI-01) |
| PO_BLOCKED | 2 PO_CONTENT_PENDING (48 venture fields; venture tab fields) |
| ENV_BLOCKED | 4 (live Google ×3, "Fintech" catalogue item ×1) |
| OUT_OF_SCOPE | 1 (US-02.10-AC05, superseded by DEC-ADM-PD3) |

## Unassigned implementation gaps (26 AC, no task owns them)

| Area | AC |
|---|---|
| onboarding behaviour | US-01.03-AC03 session expiry keeps input · US-01.09-AC08 "Quay lại" saves Bước 2 · US-01.10-AC02 ≥ 1 role · US-01.12-AC03 "Sửa" returns to Bước 4 · US-01.13-AC03 2 cards |
| public profile (UAT supersedes DEC-WF02-H3) | US-01.12-AC05 · US-02.01-AC01/02/04 · US-02.06-AC02/03 (slug + redirect) · US-02.07-AC04 · US-02.08-AC02 (+ S1-UAT-03B tags) |
| profile content | US-02.02-AC03/05 Chính/Phụ + years · US-02.03-AC01 org on HUB · US-02.03-AC05 delete confirmation · US-02.04-AC01 education card · US-02.04-AC02/03 certificates · US-02.05-AC01…03 system-recorded sections |
| settings | US-02.07-AC01/02 purpose consent · US-02.08-AC03 sole-owner deletion gate |

Also to confirm inside S1-UAT-06: venture delete (US-02.15-AC04), pitch-deck storage (US-02.15-AC05), 20-word summary (US-02.10-AC04), Project → Startup conversion (US-02.15-AC03), UAT stage labels. Observations: the VI | EN switch is inert; a guest opening `/me` or `/projects/new` directly reaches `/auth` without `redirect`; US-02.16-AC02 would fail today ("Gửi duyệt" self-publishes).

## Minimum gates before S1-UAT-09B can pass

| # | Gate | Closes |
|---|---|---|
| G1 | S1-UAT-07-FIX-01 PASS_WITH_EVIDENCE → PO accepts S1-UAT-07 → integrated into the candidate → regression | 21 AC |
| G2 | S1-UAT-03 implemented and accepted (FB-06, FB-07, FB-11, FB-12, FB-13) | 13 AC |
| G3 | S1-UAT-03B implemented and accepted (one request per position, PD-1 routing, withdraw / edit / resubmit, tracking) | 10 AC |
| G4 | S1-UAT-06 non-AI scope implemented and accepted (FB-17 tags 1–3, website / logo, "Gửi duyệt" wired to review, hide, conversion, stage labels, delete / pitch deck / 20 words) | 15 AC |
| G5 | LEGAL-AI-01 resolved and S1-UAT-04 / S1-UAT-06 AI delivered, **or** a recorded PO decision removing AI from Sprint 1 UAT | 11 LEGAL + 2 AC |
| G6 | PO answers Q1 and Q2; PO supplies the 48-field list and venture tab fields; UAT wording amended where a newer PO decision governs (US-01.02-AC02, US-02.10-AC02/05, US-02.11-AC01) | 4 AC + text |
| G7 | an owner and a task for the 26 unassigned AC (or a recorded PO waiver) | 26 AC |
| G8 | PO / ChatGPT acceptance of S1-UAT-01, 02, 05, 08A, 09 | the 62 READY AC |
| G9 | one frozen Sprint 1 candidate SHA containing every accepted task, full protected regression GREEN, deployed by exact SHA to the UAT environment | all AC |
| G10 | UAT environment: live Google OAuth, e-mail provider, `INVITE_LINK_SECRET`, upload limit for AI routes, vocabulary items used by the AC (e.g. "Fintech"), roster import from the PO list | 4 ENV AC + execution of the rest |
| G11 | test data U2, U4–U9 and files prepared on the UAT environment ([account-ready-matrix](account-ready-matrix.md)) | execution of every AC |

S1-UAT-09B can pass only when every AC is READY or carries a recorded PO waiver / OUT_OF_SCOPE decision, and G8–G11 hold.

## Related

- [overview](overview.md)
- [task-coverage](task-coverage.md)
- [business-decisions](business-decisions.md)
- [account-ready-matrix](account-ready-matrix.md)
