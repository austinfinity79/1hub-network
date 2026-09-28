# TASK-22-2809 Scope Refreeze

**TASK 22 — Thảo 28/09 decision ingest + scope refreeze: DONE (docs only).**
- **Source:** `~/Downloads/Update 28_9.docx`, sha256 `92f62747…eb14` (the task names it `Update 28_9(1).docx`; no `(1)` copy exists on this machine).
- **Output:** [design-revision/scope-refreeze/](../../design-revision/scope-refreeze/overview.md) and [DEC-2809-D1…D7](../../decisions/DECISION_LOG.md#dec-2809).
- **Runtime, schema, migration, API, RBAC changes:** 0.

## Method
1. Source review: the docx (74 lines) against the Task 21 v2 audit (00–07), the corrected ZIPs (L6, L2, L4, L5 frames re-opened: L54, L15, L16, L28, L37) and the decision log.
2. Code audit (read-only, two parallel explorers): homepage CTAs, auth / return path, route existence, programme-create permission; WF05 application store, Venture model, programme source, tests asserting session-only behaviour.
3. Supersede, matrix, reclassify, backend deltas, sequence, conflicts, open decisions.

## Result
| Item | Result |
|---|---|
| Decisions frozen | DEC-2809-D1…D7 (Homepage, L1 AI, L3, L4, L5 Venture, L5 Application, L6) |
| Records superseded | 15 (fully: DEC-WF05-G5, DEC-WF05-T00-D1, HC-WF05-07/09/12, HD-04, HD-06, HD-07, `/login` absence, L54 Bucket A + batches 22.5–22.8; in part: API §15, DEC-L1-D1, HD-01 + DEC-H1-D3, DEC-P0-SHELL-D2 on `/`, DEC-WF01-S05-D4, DEC-WF01-S08-D6, HD-09, HD-10) |
| Matrix | 62 screens: APPROVED ALPHA 24, FUTURE 38; current WF05-S03 / S04 session implementation SUPERSEDED |
| New Alpha screens | L06b, L06c (AI), L16 (`/events`), L37–L43 (SUB0–SUB3) |
| Newly Future | L27, L28, L47, L52, L53, L54 (+ L13 ME7 as team management) |
| L3 | L20, L26 by D3; L19, L23 independently approved (HD-A2) |
| L4 / L6 | 0 executable screens (no directory / form frame in either group) |
| Backend deltas | 11 (BD-01…BD-04, BD-06…BD-12); two need additive migrations (22.5, 22.6) |
| Conflicts | 14 traceable records C-01…C-14 |
| Open decisions | 19: HD-A1…HD-A14 + HD-02, 03, 05, 08, 11 |

## Key findings
- `/login` does not exist and no return path survives the magic link; the 28/09 CTAs need both (BD-01, BD-02).
- WF05 applications live only in `sessionStorage`, with snapshots deliberately impossible; about twelve specs assert this and must change.
- The `programmes` table exists but no runtime reads it; the published WF04 programme is a TypeScript fixture. A persisted Application therefore needs a server-side programme and question set first (BD-10).
- `POST /ventures` already supports a minimal create (type + name), so quick-create needs no new API, only audit and idempotency.
- L54 is "System Status" (404 / 500 / maintenance), which 28/09 defers; the old batch 22.7 is cancelled.

## New sequence
22.5 Application persistence foundation → 22.6 auth return-to → 22.7 L5 Application UI → 22.8 homepage CTAs + directories → 22.9 L1 AI (as soon as HD-A1 closes) → 22.10 consolidation. Detail: [task-sequence.md](../../design-revision/scope-refreeze/task-sequence.md).

## Git
- Branch `main`; start HEAD `cdc5d1a`, checked again before the commit.
- Implementation commit: none (docs only). Report / docs commit: the commit that contains this report.
- Push: **NOT RUN**.

## Related
- [../CLAUDE_LATEST_REPORT.md](../CLAUDE_LATEST_REPORT.md) · [TASK-22.4_l3-chapter-wf03.md](TASK-22.4_l3-chapter-wf03.md)
