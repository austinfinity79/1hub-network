# Claude Task Report

## Task
INTERNAL ALPHA — CLOSURE DEFECT IA-P2-02 REACT HYDRATION #418 ROOT-CAUSE + REMEDIATION. Process: PROCESS-P0-ACCELERATED-SAFE-V2. Full report: [reports/IA-P2-02_hydration-418.md](reports/IA-P2-02_hydration-418.md).

## Verdict
**IA-P2-02 CLOSED — Internal Alpha READY FOR COMPLETION AUDIT RECHECK.** The draft manifest stays NOT READY; no release SHA frozen; nothing deployed or pushed.

## Scope implemented
| Item | Result |
|---|---|
| Root cause | YES. React 19.3.0 bundled in `next@15.5.26` replays a suspended page-root host `<div>` (under `InnerLayoutRouter`) without rewinding its hydration cursor when a child RSC chunk is still streaming; the replay fails to claim its own node (#418 'HTML') |
| SSR vs client | Markup identical (380 loads: SSR = DCL = first commit); the mismatch is in React's cursor, not the HTML |
| Trigger | Hydration reaches the page root before the page's child chunk arrives (load / network timing) |
| Deterministic repro | Landing stream paused after the page-root chunk: 42 / 150 unpatched |
| Fix | `patches/next@15.5.26.patch` via pnpm `patchedDependencies`: the upstream React lines (React canary `19.3.0-canary-d083ec1d-20260922`, Next 16.3.6); no app code changed |
| Rejected | Root-layout `<Suspense>`: it broke 307 / 404 status contracts, so it was reverted |
| Harness | WF05-S04 test `7/8/9` waits for the review rows before reading them (P3 race; assertion unchanged) |

## Files changed
- `patches/next@15.5.26.patch` (new), `pnpm-workspace.yaml`, `pnpm-lock.yaml`
- `tests/visual/specs/wf05-s04-review-submit.spec.ts`
- Docs: `reports/IA-P2-02_hydration-418.md` (new), `INTERNAL_ALPHA_COMPLETION_AUDIT.md`, `INTERNAL_ALPHA_UAT_MATRIX.md`, `INTERNAL_ALPHA_RELEASE_MANIFEST.md`, `P0_STATUS.md`, this report

## Migrations / data
None. Throwaway databases dropped.

## Tests
| Gate | Result |
|---|---|
| Split harness, patched, fresh server | 0 / 150 (was 42 / 150) |
| Affected tests, fresh server (dev DB) | landing / auth entry 50 / 50; WF05-S04 "never a submit" 50 / 50; 0 #418 |
| Fresh DB, fresh server | split 0 / 90; the two tests 25 / 25 each; 0 #418 |
| Full regression, fresh DB + fresh server | 664 tests: 640 passed, 24 skipped (opt-in `PIXEL_QA_SCREENS`), 0 failed, 0 #418; server log 0 lines of concern |
| Static | `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` 237 / 237, `pnpm test:db` 349 / 349, `pnpm build` (clean `.next`, 0 warnings): PASS |
| Server logs | 0 email / token / cookie / session / error lines |

## Visual QA
No UI change; the full suite's pixel and typography specs ran in the regression.

## Deviations / blockers
- Deploy task: `deploy/Dockerfile` (branch `deploy/vps-foundation`) must copy `patches/` before `pnpm install --frozen-lockfile`.
- The vendored `next` patch stays until a Next upgrade that bundles the React fix.

## Git
- Branch: `main`; start HEAD `a251240` (checked again before each commit)
- Implementation commit: `194b4b3` (IA-P2-02 patch + WF05-S04 harness wait; candidate for the final recheck, not frozen)
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
INTERNAL ALPHA COMPLETION AUDIT — FINAL RECHECK + FREEZE RELEASE SHA. Do not deploy. Not started automatically.
