# S1-SINGLE-LANE-AI-CONTRACT-RECOVER-01

Recovers the AI ingestion contract from the closed second lane into the single Sprint 1 lane `feat/sprint1-completion`, and refreshes the one stale readiness AC (US-02.14-AC04). Docs only.

## Source commit
| Item | Value |
|---|---|
| Commit | `fb2130f505fc7a30377ebc9ac7551a6dda6a733f` (branch `docs/ai-ingestion-contract`, parent `cdcf17e`) |
| Files | `docs/ai/AI_INGESTION_CONTRACT_V1.md` only (454 lines; upper-case `V1` in the file name) |
| Runtime / DB / API / migration / test files | none |
| Method | `git cherry-pick -x` (no conflict: `docs/ai/` did not exist); content byte-identical to the source |

## Contract audit
| Check | Result |
|---|---|
| Is the AI-CONTRACT-01 contract for S1-UAT-04 (AI Profile Helper, FB-05) and S1-UAT-06 (Project/Startup import, FB-15) | YES (§1) |
| Status | "PROPOSED FREEZE (docs only; nothing implemented)" |
| LEGAL-AI-01 | still an external dependency: "IMPLEMENTATION BLOCKED UNTIL LEGAL-AI-01 IS RESOLVED"; only the deterministic stub may run (§9.4, §15) |
| Provider legal approval, consent decision | not decided (§15 rows marked "Yes (LEGAL-AI-01)") |
| Quota | proposal only (20 / day), marked "Needs PO" (Q2) |
| Persistence | `AISuggestionRecord` table proposed, "migration number assigned at implementation"; the record is named by US-01.12; nothing created |
| New business behaviour | none: §3 restates US-01.08 / US-02.10 rules "preserved, not reinterpreted" |
| Links | DEC-2809-D2, DEC-L1R-D7, DEC-L2R-D11, scope-refreeze files, API contract, Privacy v1.0 — all resolve on the lane |

Dated notes (left unchanged, to revisit at S1-UAT-04 / 06): §15 says the server accepts vocabulary ids only — FB-09 free tags (`UNNORMALIZED`, S1-UAT-05) have since landed; §7 mentions migration `015` as the last taken (now `020`).

## Readiness refresh
| AC | From | To | Evidence |
|---|---|---|---|
| US-02.14-AC04 | IMPLEMENTATION_PENDING | READY | S1-UAT-07-FIX-02 (`d497da2`), [evidence](S1-UAT-07-FIX-02-evidence.md) |

Totals (160): READY 80 · IMPLEMENTATION_PENDING 62 · BUSINESS 0 · LEGAL 11 · PO content 2 · ENV 4 · OOS 1. No other AC changed.

## Related
- [AI_INGESTION_CONTRACT_V1](../../ai/AI_INGESTION_CONTRACT_V1.md)
- [sprint1-readiness overview](../../uat/sprint1-readiness/overview.md)
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
