# Claude Task Report

## Task
TASK 22-PREVIEW-LIBRARY — HOMEPAGE → PUBLIC L2 THƯ VIỆN. Full report: [reports/TASK-22-PREVIEW-LIBRARY_library.md](reports/TASK-22-PREVIEW-LIBRARY_library.md).

## Verdict
**DONE (local).** Public `/library` built from the L2-15 pack as a static demo (DEC-L15): the "Bài toán" directory runs on a labelled six-problem fixture; Startup and Nhà sáng lập are "Sắp có". The homepage "Mạng lưới đổi mới sáng tạo" opens it. Not deployed.

## Scope implemented
- `/library` page, components, fixture, client-side search / filters / sort; homepage link.
- L15 references in the revision baselines; `referenceBackdrop` in the pixel helper; spec `public-library`.

## Files changed
- New: `src/app/(public)/library/page.tsx`, `src/components/library/*`, `tests/visual/specs/public-library.spec.ts`, `design-reference/final/revision/L2/L15__library-*` (4).
- Updated: `src/components/landing/landing.tsx`, `tests/visual/specs/p0-landing.spec.ts`, `tests/visual/pixel-qa/revision.ts`, `design-reference/final/revision/README.md`, `DECISION_LOG.md` (DEC-L15), `homepage-cta-map.md`.
- Docs: this report, the task report, `P0_STATUS.md`.

## Migrations / data
None. No API, DB, auth, RBAC or e-mail change.

## Tests
format, lint, typecheck, build PASS; unit 245 / 245; regression 139 / 139 (incl. public-library 10 / 10).

## Visual QA
1440 DPR1 vs L15: Structural 0, Major 0, Component 0; P3 / intentional recorded. Responsive 1440 / 1024 / 768 / 390: 0 overflow, 0 clipped controls. #418 0, 5xx 0.

## Deviations / blockers
- PO decisions: static demo, neutral fixture names, fixture-derived counts (28/09).
- Blocking gaps: 0.

## Git
- Branch: `main`; start HEAD `4aed631`, checked again before each commit
- Implementation commit: `4c38745cc65f4f389913e2034ce43e83a070c9f6`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN**; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
PO review of `/library` locally; freeze and deploy only on instruction. Not started automatically.
