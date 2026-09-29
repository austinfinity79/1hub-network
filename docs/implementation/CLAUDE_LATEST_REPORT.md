# Claude Task Report

## Task
LIBRARY DATA UPDATE + DEPLOY. Full report: [reports/LIBRARY-DATA_deploy.md](reports/LIBRARY-DATA_deploy.md).

## Verdict
**DEPLOYED GREEN.** `2c6cc4ac4f42df252d81afc467ec541c622a07af` runs on https://1hubnetwork.io.vn.

## Scope implemented
- "Bài toán" runs on the supplied problem dataset (47 records) through a server-side adapter; facets, counts and search derive from it; the demo fixture is removed; missing prize, deadline, team count and logo render nothing invented.
- Public source labels removed from all three Library tabs ([DEC-L15-D9](../decisions/DECISION_LOG.md#dec-l15-d9)).
- Deployed the exact SHA with the existing tooling; no database change.

## Files changed
- `src/lib/library/dir-bai-toan.json`, `problem-adapter.ts`, `problem-adapter.test.ts`, `problem-source.ts`; `src/components/library/library-client.tsx`, `library-model.ts`, `library.tsx`, `library.module.css`; `library-data.ts` deleted; `src/app/(public)/library/page.tsx`; `.prettierignore`; `tests/visual/specs/public-library.spec.ts`.
- Docs: `DECISION_LOG.md` (DEC-L15-D9), this report, the deploy report, `P0_STATUS.md`. Deploy branch: `LIBRARY_DATA_DEPLOYMENT.md`, `VPS_DEPLOYMENT.md`.

## Migrations / data
None. Backup `onehub-20260929T104837Z.dump` by procedure.

## Tests
format, lint, typecheck, build PASS; unit 17 / 17; `public-library` 16 / 16; 1440 / 1024 / 768 / 390 clean on all tabs, locally and on the domain.

## Visual QA
Layout unchanged (gutter 45, columns 358 / 705 / 1052, cards 324 × 431). Card rows now checked by geometry, not pixels (record colours and text).

## Deviations / blockers
- The dataset was read from `~/Downloads/dir-bai-toan.json`; `/mnt/data` does not exist on this machine.
- Prize hidden on all 47 (`giai_thuong` null), including the 17 whose display reads "Đang đàm phán".
- Hero "Tìm nhanh" chip "AI" matches no problem tag (the data says "Dữ liệu & AI"); chips unchanged.
- Blocking gaps: 0.

## Git
- Branch: `main`; start HEAD `c448885567aec8f11446e30afb494a9210964fc8`; no concurrent change
- Implementation commit: `2c6cc4a` (deployed)
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** (not requested)
- Remote HEAD: `53599925f5aef6abf20127e293611e4f758f898b` (tracking ref), unchanged; local `main` is ahead of it
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
PO review of `/library` on the domain. Not started automatically.
