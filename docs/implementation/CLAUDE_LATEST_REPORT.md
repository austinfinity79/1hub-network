# Claude Task Report

## Task
TASK 22.1 — CORRECTED PUBLIC HOMEPAGE (Bucket A). Full report: [reports/TASK-22.1_public-homepage.md](reports/TASK-22.1_public-homepage.md).

## Verdict
**DONE.** HD-12 is CLOSED as [DEC-HD-12](../decisions/DECISION_LOG.md#dec-hd-12). Batch 22.2 is not started.

## Scope implemented
- **Design rule update:**
  - Design SOT §2.2 / §2.3 scoped Space Grotesk rule;
  - one CLAUDE.md §5 line;
  - DEC-HD-12 and DEC-H1 in the decision log.
- **Font setup:** `@fontsource/space-grotesk` 5.3.0 synced into `public/fonts` (12 files); no CDN.
- **Harness:** `REVISION_FACES` for revision screens only.
- **Homepage:**
  - `/` rebuilt to the corrected reference (`design-reference/final/revision/H1`);
  - approved copy kept; HD-01 placeholder and unverified blocks omitted;
  - 17 active links and 26 inert items for a guest; 0 `href="#"`.

## Files changed
- `CLAUDE.md`, `docs/design/00_DESIGN_PIXEL_SOT_FINAL_v1.0.md`, `docs/decisions/DECISION_LOG.md`
- `package.json`, `pnpm-lock.yaml`, `scripts/sync-fonts.mjs`, `src/styles/fonts.css`, `src/styles/fonts.test.ts`, `public/fonts/space-grotesk-*` (12)
- `design-reference/final/revision/` (H1 reference + README)
- `src/components/landing/` (`landing`, `landing-story`, `landing-network`, `landing-parts`; `landing` / `story` / `network` CSS modules)
- `tests/visual/pixel-qa/capture.ts`, `segments.ts`, `tests/visual/specs/p0-landing.spec.ts`, `typography-foundation.spec.ts`
- Docs: `docs/design-revision/04`, `05`, `07`; this report; the task report; `P0_STATUS.md`

## Migrations / data
None. Business, API, DB and RBAC changes: 0. The WF01–WF03 baselines and `manifest.yaml` are untouched.

## Tests
- Format, lint, typecheck, unit 237, DB 349, build: PASS.
- Full visual suite: 643 passed / 24 opt-in skipped / 0 failed (after the typography-foundation count update, 27 declarations).

## Visual QA
- 1440×900 DPR1 against H1, 22 kept blocks.
- Diff outside text max 0.99 %; diff beyond ±2 px max 1.40 %.
- Structural 0 · Major 0 · Component 0 · P3 raster residual · typography violations 0.
- Responsive 1024 / 768 / 390: 0 overflow, 0 covered or off-screen CTA.

## Deviations / blockers
- **Intentional:**
  - HD-01 omissions;
  - the fourth pain item wraps instead of being clipped;
  - mono labels use IBM Plex Mono (the reference mono family is unproven).
- **PO review:** the revision copy names investment and recruitment (DEC-H1-D2).
- No blocker.

## Git
- Branch: `main`; start HEAD `d460914`, checked again before each commit
- Implementation commit: `a05917a47c362712b770a63f78d4640f358b6710`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
TASK 22.2 — L1 AUTH / ONBOARDING BUCKET A. Not started automatically.
