# Overview

S1-UAT-09B-PREP: readiness of the Sprint 1 formal UAT (33 user stories, 160 acceptance criteria) for the **eventual Sprint 1 UAT candidate**, prepared 2026-10-06 while S1-UAT-07 continues. Audit and preparation only: no product, API, DB or migration change. **S1-UAT-09B is not PASS.**

## Sources

| Source | Use |
|---|---|
| `1hubnetwork_uat_sprint1_wf01_wf02.md` (PO pack, 1977 lines) | the 33 US / 160 AC, Appendix A test data, B decisions, D out of scope, E catalogues |
| `1hubnetwork_feedback_sprint1.md` | FB-01 … FB-20 |
| `docs/decisions/DECISION_LOG.md`, `docs/implementation/reports/` | frozen SOT and task evidence |
| branch `feat/s1-uat-09-polish` (`5a13ccb`) | code = main + S1-UAT-01, 02, 08A, DB-SAFETY-01, 05, 09 |
| candidate `int/sprint1-candidate-01` (S1-CANDIDATE-INT-01) | S1-UAT-07 (incl. FIX-01) + S1-UAT-09 + these docs on `6ab6cbc`; counts below are for this candidate |
| [`docs/ai/AI_INGESTION_CONTRACT_V1.md`](../../ai/AI_INGESTION_CONTRACT_V1.md) (from `docs/ai-ingestion-contract` `fb2130f`, recovered into `feat/sprint1-completion`) | AI contract, LEGAL-AI-01 gate |

## Method

1. Every AC was extracted from the pack in document order and given a stable ID `<US>-ACnn` (line number kept in `UAT_LINE`).
2. Each AC was checked against code, tests and decisions and given exactly one status, by precedence: OUT_OF_SCOPE → LEGAL_BLOCKED → BUSINESS_DECISION_BLOCKED → PO_CONTENT_PENDING → IMPLEMENTATION_PENDING → ENV_BLOCKED → READY.
3. READY means the behaviour exists on the Sprint 1 chain with code and test evidence. Integrating that chain into one frozen candidate and deploying it is a global gate (see [readiness-gaps](readiness-gaps.md)), not a per-AC downgrade.
4. S1-UAT-07 rule (task correction 06/10): every AC whose readiness depends on S1-UAT-07 is IMPLEMENTATION_PENDING with the note "S1-UAT-07 implemented on isolated branch; final fix/review and integration into Sprint1 candidate still pending", until S1-UAT-07-FIX-01 passes, the PO accepts it, it is integrated and regression passes.
5. Every cited decision ID was checked to exist; key quotes were re-read in the log.
6. Decision reconciliation (final pass): each conflict was resolved by provenance and date before any PO question; the latest explicit PO source governs ([business-decisions](business-decisions.md)).

## Counts

| Check | Value |
|---|---|
| US_COUNT | 33 |
| AC_COUNT | 160 (P0 135 · P1 25) |
| UNMAPPED_AC | 0 |
| DUPLICATED_AC | 0 |

| Status | All | P0 | P1 |
|---|---|---|---|
| READY | 80 | 67 | 13 |
| IMPLEMENTATION_PENDING | 62 | 53 | 9 |
| BUSINESS_DECISION_BLOCKED | 0 | 0 | 0 |
| LEGAL_BLOCKED | 11 | 11 | 0 |
| PO_CONTENT_PENDING | 2 | 1 | 1 |
| ENV_BLOCKED | 4 | 2 | 2 |
| OUT_OF_SCOPE | 1 | 1 | 0 |

Stories fully READY: 9 of 33 (US-01.01, US-01.02, US-01.04, US-01.06, US-02.11, US-02.12, US-02.14, US-02.17, US-X.01). FB-02/03/04/19/20 are PO direct acceptance and are not among the 160 AC (pack Appendix D). True PO decisions remaining: 0 (PD-5, PD-6 frozen 06/10, [business-decisions](business-decisions.md)).

## Preliminary vs final

The 06/10 preliminary count of the first pass (READY 62 · PENDING 56 · BUSINESS 27 · LEGAL 11 · ENV 4) changed by:

| AC | From | To | Why |
|---|---|---|---|
| US-02.09-AC02 | READY | IMPLEMENTATION_PENDING | one of its 2 buttons ("Mời thành viên") opens the flow S1-UAT-07 reworks |
| US-02.11-AC01 | BUSINESS | IMPLEMENTATION_PENDING | S1-UAT-07 rule; the business conflict stays in BLOCKER |
| US-02.15-AC03 | IMPLEMENTATION_PENDING | BUSINESS | first pass: UAT Appendix B vs DEC-WF02-S05-G4 (reverted by the final pass) |

Final pass (decision reconciliation) moved the 27 BUSINESS AC: 1 → READY (DEC-S1A-D11), 22 → IMPLEMENTATION_PENDING (UAT 02/10 newer than the 26/09 – 29/09 freezes, or website half of PD-3), 2 → PO_CONTENT_PENDING (48 fields, tab fields), 1 → OUT_OF_SCOPE (superseded by DEC-ADM-PD3), 2 stay BUSINESS (Q1, Q2). Result: READY 62 · IMPL 78 · BUSINESS 2 · LEGAL 11 · PO content 2 · ENV 4 · OOS 1.

PO decision freeze (06/10): PD-5 and PD-6 move US-02.06-AC01 and US-02.06-AC04 to IMPLEMENTATION_PENDING. Result: READY 62 · IMPL 80 · BUSINESS 0 · LEGAL 11 · PO content 2 · ENV 4 · OOS 1.

Candidate refresh (S1-CANDIDATE-INT-01, 06/10): S1-UAT-07 + FIX-01 integrated with S1-UAT-09; full regression 1236 PASS / 0 FAIL / 29 SKIP, UAT L1-L2 19 / 19, DB 849 / 849. 17 invitation AC → READY with evidence; US-02.14-AC04 (owner never sees "Đã từ chối") and US-X.02-AC01…03 (S1-UAT-06 / 03B cases) stay pending. Result: READY 79 · IMPL 63 · BUSINESS 0 · LEGAL 11 · PO content 2 · ENV 4 · OOS 1.

FIX-02 refresh (S1-SINGLE-LANE-AI-CONTRACT-RECOVER-01, 06/10): S1-UAT-07-FIX-02 (`d497da2`, fast-forwarded into the candidate; full regression 1237 PASS / 0 FAIL / 29 SKIP / 0 FLAKY) delivers the owner's "Đã từ chối" line and re-invite: US-02.14-AC04 → READY. No other AC changed. Result: READY 80 · IMPL 62 · BUSINESS 0 · LEGAL 11 · PO content 2 · ENV 4 · OOS 1.

## Files

| File | Content |
|---|---|
| [traceability.csv](traceability.csv) | 160 rows: US_ID, AC_ID, PRIORITY, RELATED_FB, IMPLEMENTATION_TASK, CURRENT_STATUS, TEST_METHOD, EXPECTED_EVIDENCE, BLOCKER, READY_FOR_UAT, AC_TEXT, EVIDENCE_REF, UAT_LINE |
| [task-coverage](task-coverage.md) | AC per task and the cross-cutting dependencies |
| [business-decisions](business-decisions.md) | chronology, the 12 reconciled groups and the PD-5 / PD-6 freeze |
| [account-ready-matrix](account-ready-matrix.md) | U1–U9, files, master data |
| [readiness-gaps](readiness-gaps.md) | gaps and the minimum gates before S1-UAT-09B can pass |

## Related

- [S1-UAT-09-polish report](../../implementation/reports/S1-UAT-09-polish.md)
- [DECISION_LOG](../../decisions/DECISION_LOG.md)
