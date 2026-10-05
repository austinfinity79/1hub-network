# Overview

S1-UAT-09B-PREP: readiness of the Sprint 1 formal UAT (33 user stories, 160 acceptance criteria) for the **eventual Sprint 1 UAT candidate**, prepared 2026-10-06 while S1-UAT-07 continues. Audit and preparation only: no product, API, DB or migration change. **S1-UAT-09B is not PASS.**

## Sources

| Source | Use |
|---|---|
| `1hubnetwork_uat_sprint1_wf01_wf02.md` (PO pack, 1977 lines) | the 33 US / 160 AC, Appendix A test data, B decisions, D out of scope, E catalogues |
| `1hubnetwork_feedback_sprint1.md` | FB-01 … FB-20 |
| `docs/decisions/DECISION_LOG.md`, `docs/implementation/reports/` | frozen SOT and task evidence |
| branch `feat/s1-uat-09-polish` (`5a13ccb`) | code = main + S1-UAT-01, 02, 08A, DB-SAFETY-01, 05, 09 |
| branch `feat/s1-uat-07-invite` (git objects only) | S1-UAT-07 evidence; never counted as READY |
| branch `docs/ai-ingestion-contract` | AI contract, LEGAL-AI-01 gate |

## Method

1. Every AC was extracted from the pack in document order and given a stable ID `<US>-ACnn` (line number kept in `UAT_LINE`).
2. Each AC was checked against code, tests and decisions and given exactly one status, by precedence: OUT_OF_SCOPE → LEGAL_BLOCKED → BUSINESS_DECISION_BLOCKED → PO_CONTENT_PENDING → IMPLEMENTATION_PENDING → ENV_BLOCKED → READY.
3. READY means the behaviour exists on the Sprint 1 chain with code and test evidence. Integrating that chain into one frozen candidate and deploying it is a global gate (see [readiness-gaps](readiness-gaps.md)), not a per-AC downgrade.
4. S1-UAT-07 rule (task correction 06/10): every AC whose readiness depends on S1-UAT-07 is IMPLEMENTATION_PENDING with the note "S1-UAT-07 implemented on isolated branch; final fix/review and integration into Sprint1 candidate still pending", until S1-UAT-07-FIX-01 passes, the PO accepts it, it is integrated and regression passes.
5. Every cited decision ID was checked to exist; key quotes were re-read in the log.

## Counts

| Check | Value |
|---|---|
| US_COUNT | 33 |
| AC_COUNT | 160 (P0 135 · P1 25) |
| UNMAPPED_AC | 0 |
| DUPLICATED_AC | 0 |

| Status | All | P0 | P1 |
|---|---|---|---|
| READY | 61 | 51 | 10 |
| IMPLEMENTATION_PENDING | 57 | 51 | 6 |
| BUSINESS_DECISION_BLOCKED | 27 | 20 | 7 |
| LEGAL_BLOCKED | 11 | 11 | 0 |
| PO_CONTENT_PENDING | 0 | 0 | 0 |
| ENV_BLOCKED | 4 | 2 | 2 |
| OUT_OF_SCOPE | 0 | 0 | 0 |

Stories fully READY: 4 of 33 (US-01.01, US-01.04, US-01.06, US-X.01). FB-02/03/04/19/20 are PO direct acceptance and are not among the 160 AC (pack Appendix D).

## Preliminary vs final

The 06/10 preliminary count (READY 62 · PENDING 56 · BUSINESS 27 · LEGAL 11 · ENV 4) changed by:

| AC | From | To | Why |
|---|---|---|---|
| US-02.09-AC02 | READY | IMPLEMENTATION_PENDING | one of its 2 buttons ("Mời thành viên") opens the flow S1-UAT-07 reworks |
| US-02.11-AC01 | BUSINESS | IMPLEMENTATION_PENDING | S1-UAT-07 rule; the business conflict stays in BLOCKER |
| US-02.15-AC03 | IMPLEMENTATION_PENDING | BUSINESS | UAT Appendix B allows Dự án → Startup; frozen DEC-WF02-S05-G4 fixes the type |

## Files

| File | Content |
|---|---|
| [traceability.csv](traceability.csv) | 160 rows: US_ID, AC_ID, PRIORITY, RELATED_FB, IMPLEMENTATION_TASK, CURRENT_STATUS, TEST_METHOD, EXPECTED_EVIDENCE, BLOCKER, READY_FOR_UAT, AC_TEXT, EVIDENCE_REF, UAT_LINE |
| [task-coverage](task-coverage.md) | AC per task and the cross-cutting dependencies |
| [business-decisions](business-decisions.md) | the 27 conflicts grouped for the PO |
| [account-ready-matrix](account-ready-matrix.md) | U1–U9, files, master data |
| [readiness-gaps](readiness-gaps.md) | gaps and the minimum gates before S1-UAT-09B can pass |

## Related

- [S1-UAT-09-polish report](../../implementation/reports/S1-UAT-09-polish.md)
- [DECISION_LOG](../../decisions/DECISION_LOG.md)
