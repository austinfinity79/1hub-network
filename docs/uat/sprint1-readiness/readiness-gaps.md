# Readiness gaps

What stands between today and a PASS of S1-UAT-09B (Sprint 1 UAT readiness). Counts from [traceability.csv](traceability.csv).

## Gap report

| Bucket | AC |
|---|---|
| READY_NOW | 61 |
| PENDING_IMPLEMENTATION | 57 (S1-UAT-07 21 · S1-UAT-03 13 · S1-UAT-06 12 · S1-UAT-03B 9 · unassigned 8 · existing WF02 4 · S1-UAT-04 2 · S1-UAT-01 1; AC shared between tasks counted once in the total) |
| BUSINESS_BLOCKED | 27 (12 decision groups, [business-decisions](business-decisions.md)) |
| LEGAL_BLOCKED | 11 (LEGAL-AI-01) |
| PO_BLOCKED | 0 AC (PO material still needed for FB-03 / FB-19 / FB-20 outside the 160 AC, and for test files) |
| ENV_BLOCKED | 4 (live Google ×3, "Fintech" catalogue item ×1) |
| OUT_OF_SCOPE | 0 |

## Unassigned implementation gaps

| AC | Gap |
|---|---|
| US-01.03-AC03 | session expiry mid-onboarding loses unsent input (generic "Chưa lưu được thông tin") |
| US-01.09-AC08 | "Quay lại" on Bước 2 is a link and does not save the step |
| US-01.12-AC03 | "Sửa" from Bước 4 → Bước 2 → "Tiếp tục" goes to Bước 3, not back to Bước 4 |
| US-02.02-AC03/05 | specialisation Chính/Phụ and years (max 2 Chính) — no columns, no UI |
| US-02.03-AC01 | experience linked to an organisation on HUB (logo + link) |
| US-02.03-AC05 | deleting an experience asks no confirmation |
| US-02.04-AC01 | "Thêm học vấn" suggestion card |

Also outside the listed S1-UAT-06 scope, to confirm: venture delete (US-02.15-AC04), pitch-deck storage (US-02.15-AC05), the 20-word summary rule (US-02.10-AC04). Smaller observations from the audit: the VI | EN switch is inert; a guest opening `/me` or `/projects/new` directly reaches `/auth` without `redirect`; US-02.16-AC02 would fail today because "Gửi duyệt" still self-publishes.

## Minimum gates before S1-UAT-09B can pass

| # | Gate | Closes |
|---|---|---|
| G1 | S1-UAT-07-FIX-01 PASS_WITH_EVIDENCE → PO accepts S1-UAT-07 → integrated into the candidate → regression | 21 AC |
| G2 | S1-UAT-03 implemented and accepted (FB-06, FB-07, FB-11, FB-12, FB-13) | 13 AC |
| G3 | S1-UAT-03B implemented and accepted (one request per position, PD-1 routing, withdraw / edit / resubmit, tracking) | 9 AC |
| G4 | S1-UAT-06 non-AI scope implemented and accepted (FB-17 tags 1–3, website / logo, "Gửi duyệt" wired to review, hide, scope of delete / pitch deck / 20 words confirmed) | 12 AC |
| G5 | LEGAL-AI-01 resolved and S1-UAT-04 / S1-UAT-06 AI delivered, **or** a recorded PO decision removing AI from Sprint 1 UAT | 11 LEGAL + 2 AC |
| G6 | PO decision on each of the 12 conflict groups (amend UAT or reopen SOT, then implement) | 27 AC |
| G7 | an owner and a task for the 8 unassigned AC (or a recorded PO waiver) | 8 AC |
| G8 | PO / ChatGPT acceptance of S1-UAT-01, 02, 05, 08A, 09 | the 61 READY AC |
| G9 | one frozen Sprint 1 candidate SHA containing every accepted task, full protected regression GREEN, deployed by exact SHA to the UAT environment | all AC |
| G10 | UAT environment: live Google OAuth, e-mail provider, `INVITE_LINK_SECRET`, upload limit for AI routes, vocabulary items used by the AC (e.g. "Fintech"), roster import from the PO list | 4 ENV AC + execution of the rest |
| G11 | test data U2, U4–U9 and files prepared on the UAT environment ([account-ready-matrix](account-ready-matrix.md)) | execution of every AC |

S1-UAT-09B can pass only when every AC is READY or carries a recorded PO waiver / OUT_OF_SCOPE decision, and G8–G11 hold.

## Related

- [overview](overview.md)
- [task-coverage](task-coverage.md)
- [business-decisions](business-decisions.md)
- [account-ready-matrix](account-ready-matrix.md)
