# CLAUDE.md — 1hub.network P0

## 1. Source of truth precedence
Read before coding:
1. `CLAUDE.md` (this file)
2. `1HUB_IMPLEMENTATION_MASTER_SPEC_v1.3.md`
3. Workflow contracts
   - `docs/workflows/WF01_IDENTITY_ONBOARDING_FINAL_v1.0.md`
   - `docs/workflows/WF02_MEMBER_PROFILE_NETWORK_FINAL_v1.0.md`
   - `docs/workflows/WF03_HUB_CHAPTER_CLB_OPERATIONS_FINAL_v1.0.md`
4. Data SOT
   - `docs/product/1HUB_DATA_SOT_v1.1.md`
   - `docs/product/00_DATA_DECISIONS_FREEZE_v1.1.md`
5. Design SOT
   - `docs/design/00_DESIGN_PIXEL_SOT_FINAL_v1.0.md`
   - `docs/design/01_SCREEN_MAP_WF01_WF03_FINAL_v1.0.md`
   - `docs/design/SCREEN_CONTRACTS_WF01_WF03_v1.0.yaml`
   - `docs/design/DESIGN_TOKENS_v1.0.css`
   - `design-reference/final/manifest.yaml`
   - `design-reference/final/**`
6. Architecture (`docs/architecture/`, including API contract and DB schema)
7. DB migrations / deterministic fixtures (`db/migrations/`, `db/seed/`)
8. QA / Pixel QA rules (`docs/qa/05_PIXEL_QA_ARCHITECTURE_v1.1.md`)
9. Existing repository code and conventions

If sources conflict, do not guess. Stop and report the conflict.

## 2. P0 scope
Production implementation scope:
- WF01 Identity & Onboarding
- WF02 Member Profile & Network
- WF03 HUB/Chapter/CLB Operations

WF04/WF05 are demo-only unless explicitly promoted. WF06 is future/read-model architecture only.

## 3. Hard business rules
- One `UserAccount` → one root `IndividualProfile`.
- Account, profile, identity verification are separate concerns.
- Membership, leadership and role assignment are separate records.
- Self-selection never auto-creates ACTIVE membership.
- P0 confirmed network relationship uses preseed + pending fallback.
- Programme/Challenge share one aggregate with subtype.
- Event is canonical and may be standalone or linked to Programme.
- Project/Startup is canonical and reusable across programmes.
- Consent is versioned; visibility is separate.
- Profile completion is server-derived from the frozen 10 groups; client never submits percent.
- REGION/DOMAIN/SKILL use controlled vocabulary IDs.

## 4. API/security rules
- API base `/api/v1`.
- Browser session uses secure HTTP-only cookie.
- Never trust role/scope from local storage or frontend route.
- Every mutation checks actor + capability + resource scope + lifecycle server-side.
- Return DTOs, never raw ORM entities.
- Sensitive reads apply visibility/consent/relationship filters server-side.
- Sensitive mutations produce audit events.
- Use frozen error envelope and endpoint contract in `05_API_CONTRACT_P0_v1.0.*`.

## 5. Design rules
- Default UI font: Be Vietnam Pro.
- Archivo Bold / IBM Plex Mono only where explicitly approved by Design SOT.
- Keep 1hub red/burgundy identity; do not import APEC blue.
- Pixel baseline is `design-reference/final` only.
- Target desktop viewport: 1440×900, DPR1.
- Long pages may scroll; do not squash full-page references into 900px.
- Do not redesign an approved screen to make implementation easier.

## 6. Visual QA gate
For each Production screen/task:
1. functional behavior passes;
2. typography assertion passes;
3. screenshot at 1440×900 DPR1 with deterministic fixture;
4. compare with approved reference;
5. classify mismatch: structural / major / component / raster noise / intentional;
6. fix verified structural/major/component mismatches;
7. workflow smoke passes;
8. regression passes;
9. commit;
10. STOP. Do not start the next screen automatically.

Never overwrite baseline images to hide a mismatch.

## 7. Coding scope discipline
- Implement only the requested milestone/screen.
- Reuse shared primitives instead of screen-local patches.
- Do not invent missing business rules, enums, statuses, routes or permissions.
- Do not refactor unrelated modules during a scoped screen task.
- Do not turn demo/future designs into production APIs.

## 8. Database rules
- PostgreSQL schema source: `db/migrations/001_p0_init.sql`.
- Development/visual fixtures: `db/seed/seed_dev.sql`.
- Real roster values are imported separately; never invent production Chapter/CLB names.
- Prefer additive migrations. Never rewrite an applied migration in a real environment.

## 9. Required quality commands
Every task must run the project's equivalents of:
- format check
- lint
- typecheck
- unit/integration tests relevant to the task
- production build
- workflow smoke
- visual capture/diff when UI changes

Report failures; do not silently skip them.

## 10. Task report format
At task end report only:
- scope implemented
- files changed
- migrations/data changes
- tests/build result
- visual QA result
- intentional deviations / blockers
- commit hash (if commits are enabled)

Then STOP.

## 11. GitHub task handoff rule
GitHub is the handoff layer: Claude Code → GitHub → review. Push is part of task
completion, not an optional follow-up.

For every authorized implementation task:
1. Complete only the authorized scope.
2. Run all applicable quality gates.
3. Update `docs/implementation/CLAUDE_LATEST_REPORT.md`.
4. Archive the task report under `docs/implementation/reports/`.
5. Commit all authorized implementation/report changes.
6. Push all task commits to the CURRENT tracked branch.
7. Verify the remote contains the final task/report commit.
8. Verify the working tree is clean.
9. STOP.

Hard rules:
- Never force-push.
- Never rewrite remote history automatically.
- Never push credentials or secrets.
- Never change the remote repository or branch strategy unless explicitly authorized.
- Do not automatically create pull requests.
- Do not automatically merge branches.
- Do not start the next task after pushing.

A task may be reported DONE only when implementation gates PASS **and** the
report is committed **and** the remote push is verified. If gates pass but the
push fails, the task is not handed off: report `PUSH FAILED` with the exact
non-secret reason, and STOP.

Verification means comparing the local HEAD SHA against the remote SHA. Command
output alone is not proof of push.

## 12. Report Git section
Every `CLAUDE_LATEST_REPORT.md` must carry these fields under Git:
- Branch
- Implementation commit
- Report/final commit
- Remote
- Push status: PASS / FAIL / NOT RUN
- Remote HEAD
- Working tree status

Never record a remote URL containing credentials.

## 13. Local workspace single-writer rule
Multiple Claude/Cowork sessions may be open against this repository. Only ONE
may write at a time.

- Only one session may modify files, commit, migrate database state or push.
- Every other session stays read-only for the duration.
- Record the starting HEAD before every implementation task.
- Re-check HEAD immediately before committing.
- If HEAD changed during a task, STOP and report `CONCURRENT WORKSPACE MUTATION`.
- Never automatically merge, rebase, reset or revert work created by another
  active session, and never commit files that session left uncommitted.

In LOCAL REVIEW MODE, do not push unless the task explicitly authorizes it.

Why this exists: during M0-T06B a second session committed and pushed three
commits mid-task, including a memo the other session had authored and had not
finished reviewing. Nothing was lost that time. The next collision will not be
as lucky.

## 14. Execution process — PROCESS-P0-ACCELERATED-SAFE-V2
Installed 2026-09-26 for remaining Phase 0 work: [docs/implementation/PROCESS_P0_ACCELERATED_SAFE_V2.md](docs/implementation/PROCESS_P0_ACCELERATED_SAFE_V2.md).
- Contract freeze gate before every runtime task: all applicable Business / Data / API / Design / Security contracts frozen → fast path; otherwise full preflight → decision → STOP.
- Targeted tests and pixel per task; full regression when a workflow closes, the auth/security foundation, a broad migration or a shared/global primitive changes, or for a release candidate. Thresholds are unchanged (P0–P2 pixel mismatches must be fixed).
- CLOSED decisions are immutable inputs; reopen only on new contradictory evidence with a traceable conflict record.
- A workflow closes only through the closing gate with a GREEN verdict. WF01 and WF02 are PROTECTED / CLOSED / GREEN.
- Deploys use the exact approved SHA, never HEAD.
- Speed never overrides correctness; a Design/SOT conflict is a STOP. This process changes no product decision, and §1–§13 remain in force.
