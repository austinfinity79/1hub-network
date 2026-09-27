# Claude Task Report

## Task
INTERNAL ALPHA — CLOSURE DEFECT IA-P2-02 REACT HYDRATION #418 ROOT-CAUSE + REMEDIATION. Process: PROCESS-P0-ACCELERATED-SAFE-V2. Method: deterministic instrumentation (the full-suite hunting loop was stopped on instruction).

## Verdict
**IA-P2-02 CLOSED.** Root cause proven and reproduced on demand, fixed by a backport of React's upstream fix, verified on a fresh server and a fresh DB. Internal Alpha: **READY FOR COMPLETION AUDIT RECHECK** (not GREEN until that recheck freezes a release SHA). The draft manifest stays NOT READY. Nothing deployed or pushed.

## Root cause
| Item | Finding |
|---|---|
| Component | The page root host `<div>` under Next's `InnerLayoutRouter` (framework; minified `T`, chunk 8910). React componentStack at the error: `div ← InnerLayoutRouter ← …`. Landing: `<div class="landing_page…">`; WF05-S04: the member shell root |
| SSR vs client markup | **Identical.** SSR = DOM at DOMContentLoaded = DOM at the first commit (380 loads compared, 0 differences); the server is deterministic (750 + 300 fetches byte-identical, with concurrent RSC prefetches). No app nondeterminism |
| Actual mismatch | Inside React's hydration cursor. React 19.3.0 (bundled in `next@15.5.26` `dist/compiled/react-dom`) hydrates in a transition, possibly before the RSC payload has fully streamed. Flight outlines the page tree into lazy chunks (landing: `4:` page root div, `10`–`1a` its sections). When the root div has claimed its DOM node and a child chunk is still pending, the work loop suspends, then **replays** that host fiber (`replaySuspendedUnitOfWork` → `replayBeginWork`, HostComponent). 19.3.0 does not rewind `hydrationParentFiber` / `nextHydratableInstance` first, so the replayed div looks for its node past its own node, fails, and throws. #418 `'HTML'`, then React client-renders from the root (head meta / title / fonts re-inserted) |
| Trigger | Timing: the chunk for the page's children arrives after hydration has reached the page root. In the suite this happened under load (2 of the last 6 full runs, never in isolation) |
| Why not seen in dev | `next dev` schedules differently: 36 instrumented loads, 0 findings; a positive control (injected element) proved the detector |
| Upstream | Fixed in React canary `19.3.0-canary-d083ec1d-20260922` and in the React bundled with Next 16.3.6 / 16.4.0-canary.50. No Next 15.5.x release carries it; 15.5.26 is the latest 15.5.x |

## Deterministic reproduction
Harness (not committed, `tests/visual/actual/h418/split.mjs`): a proxy serves the production landing and pauses the HTML stream for 150 ms right after a chosen RSC chunk; an init script records the `onRecoverableError` componentStack, commits and DOM mutations.

| Pause after | Unpatched | Patched |
|---|---|---|
| nothing, `0:` (root), `a:` (head meta), `f:` (client refs) | 0 / 20 each | — |
| `4:` page root div | 6 / 20; 14 / 50 | 0 / 50; fresh DB 0 / 30 |
| `10:` first section content | 7 / 20; 14 / 50 | 0 / 50; fresh DB 0 / 30 |
| `17:` / `18:` sections | 2 / 20, 6 / 20; `18:` 14 / 50 | `18:` 0 / 50; fresh DB 0 / 30 |
| `19:` (after the root resolved) | 0 / 20 | — |

The error needs exactly this: the page root claimed, a descendant chunk still pending. Total 42 / 150 unpatched against 0 / 150 patched.

## Fix
`patches/next@15.5.26.patch`, registered in `pnpm-workspace.yaml` `patchedDependencies` (lockfile records its hash). It adds 8 lines to `next/dist/compiled/react-dom/cjs/react-dom-client.production.js` and `.development.js`, the upstream lines: before a suspended HostComponent is replayed, pop the hydration cursor back to that fiber and point `nextHydratableInstance` at its own DOM node. No application code changes. pnpm refuses an unused patch, so a Next upgrade must drop the patch explicitly. Remove it when moving to a Next that bundles the fix.

Rejected: a `<Suspense>` around `{children}` in `src/app/layout.tsx` (0 / 150) broke HTTP status contracts: guest `/me` answered 200 instead of 307, an IDOR 200 instead of 404, and `/ops/network` 200. It was reverted, so the layout is unchanged. Not used: `suppressHydrationWarning`, SSR off, client-only, retries or sleeps, weakened assertions.

Harness fix (P3, found by the instrumented runs): the WF05-S04 test `7/8/9` read the review answers with a one-shot `evaluate` before the review rendered (1 failure in 640). It now waits for the two `[data-review-answer]` rows first; the assertion itself is unchanged.

## Files changed
- `patches/next@15.5.26.patch` (new), `pnpm-workspace.yaml`, `pnpm-lock.yaml`
- `tests/visual/specs/wf05-s04-review-submit.spec.ts` (wait before read)
- Docs: this report, `INTERNAL_ALPHA_COMPLETION_AUDIT.md`, `INTERNAL_ALPHA_UAT_MATRIX.md`, `INTERNAL_ALPHA_RELEASE_MANIFEST.md`, `P0_STATUS.md`, `CLAUDE_LATEST_REPORT.md`

## Migrations / data
None. Throwaway databases `hubnetwork_h418_fix`, `hubnetwork_h418_fresh` and the audit's `hubnetwork_ia_fresh` dropped; the dev DB is untouched.

## Tests
| Gate | Result |
|---|---|
| Split harness, patched build, fresh server | 0 / 150 (was 42 / 150) |
| SSR after the patch | Unchanged (`<body><div hidden><!--$--><!--/$--></div><div class="landing_page…`); guest `/me` 307, unknown route 404 |
| Affected tests, fresh server, dev DB | `p0-shell-navigation` "landing and auth entry…" 50 / 50; `wf05-s04` "18–21/23/24 … never a submit" 50 / 50; 0 #418 |
| Fresh DB (001→009 + seed), fresh server | Split 0 / 90; the two tests 25 / 25 each; 0 #418 |
| Full regression, fresh DB + fresh server | 664 tests: 640 passed, 24 skipped (opt-in `PIXEL_QA_SCREENS`), 0 failed, 0 #418; server log 0 lines of concern |
| Static | `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` 237 / 237, `pnpm test:db` 349 / 349, `pnpm build` (clean `.next`, 0 warnings): PASS |
| Server logs | 0 email / token / cookie / session / error lines |

## Deviations / blockers
- **Deploy requirement (deploy task):** `deploy/Dockerfile` on `deploy/vps-foundation` copies only `package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc` before `pnpm install --frozen-lockfile`. It must also copy `patches/` before the install. Checked: without it the install stops with `ENOENT … patches/next@15.5.26.patch` (fails loudly, never builds unpatched). The deploy branch is untouched here.
- Vendored patch of a framework dependency until the Next upgrade (see Fix).

## Git
Branch `main`, start HEAD `a251240`; implementation commit `194b4b3`; report commit: the docs commit after it. Push NOT RUN (LOCAL REVIEW MODE). Details: [CLAUDE_LATEST_REPORT.md](../CLAUDE_LATEST_REPORT.md).

## Related
- [INTERNAL_ALPHA_COMPLETION_AUDIT.md](../INTERNAL_ALPHA_COMPLETION_AUDIT.md) — audit
- [INTERNAL-ALPHA_completion-audit.md](INTERNAL-ALPHA_completion-audit.md) — audit that opened IA-P2-02
