# Claude Task Report

## Task
HOMEPAGE IMAGE REPLACEMENT + DEPLOY. Full report: [reports/HOMEPAGE-IMAGES_deploy.md](reports/HOMEPAGE-IMAGES_deploy.md).

## Verdict
**DEPLOYED GREEN.** `91ba7a8de792bb7e382a94050f620c1f61bc8bc5` runs on https://1hubnetwork.io.vn.

## Scope implemented
- Replaced the homepage event (3), programme (3) and pipeline (1) placeholder art with the Hub's photos, optimised to webp; layout, copy and logic unchanged. The Kawai picture has no card and is not used.
- Backed up the production database and deployed the exact SHA with the existing tooling.

## Files changed
- `public/home/*.webp` (7), `src/components/landing/landing-activities.tsx`, `src/components/landing/activity-cards.module.css`, `tests/visual/specs/p0-landing.spec.ts`, this report, the deploy report, `P0_STATUS.md`.
- Deploy branch: `docs/deployment/HOMEPAGE_IMAGES_DEPLOYMENT.md`, `VPS_DEPLOYMENT.md`.

## Migrations / data
None. Backup `onehub-20260929T101820Z.dump`.

## Tests
format, lint, typecheck, build PASS; `p0-landing` 10 / 10; visual 1440 / 390: 7 / 7 pictures, no layout shift, no overflow, #418 0. Domain: `/` and all 14 picture URLs 200; #418 0; 5xx 0.

## Visual QA
H1 pixel: the replaced pictures are masked as an intentional PO difference; every other area within the thresholds.

## Deviations / blockers
- The H1 capture does not scroll, so lazy pictures were never in the compared pixels; the mask records the change instead of hiding it.
- Blocking gaps: 0.

## Git
- Branch: `main`; start HEAD `ced90343d30d080450d49a364e55557947f1b71a`; no concurrent change
- Implementation commit: `91ba7a8` (deployed)
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** (not requested)
- Remote HEAD: `53599925f5aef6abf20127e293611e4f758f898b` (tracking ref), unchanged; local `main` is ahead of it
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
PO review of the homepage on the domain. Not started automatically.
