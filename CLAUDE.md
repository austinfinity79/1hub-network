# CLAUDE.md — 1hub.network P0

## 1. Source of truth precedence
Read before coding:
1. Business SOT / workflow docs
2. Data SOT + data freeze
3. Design Pixel SOT + screen contracts
4. Architecture + API contract
5. This file
6. Existing code

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
