# Claude Task Report

## Task
INTERNAL ALPHA COMPLETION AUDIT — FINAL RECHECK + FREEZE RELEASE SHA. Process: PROCESS-P0-ACCELERATED-SAFE-V2. Audited SHA `dcbde62d94b3e6fa0fcc3cb361acf66023d6ad9f` (start HEAD; code = `194b4b3`). Method: an exact `git archive` of the SHA in a clean temp tree → `pnpm install --frozen-lockfile` → gates and build in that tree → server started from that tree → fresh PostgreSQL → full suite run from that tree.

## Verdict
**NOT GREEN — release SHA NOT frozen; manifest stays NOT READY.** One gate fails: basic responsive safety (**IA-P2-03**, P2, open). All other gates pass; IA-P2-02 stays closed. One unexplained DB-test stall is recorded (**IA-OBS-01**). Nothing deployed or pushed.

## Gates
| # | Gate | Result | Evidence |
|---|---|---|---|
| 1 | Patch reproducibility | PASS | Patch tracked (sha256 `989560c2…` = lockfile `patch_hash`); `pnpm-workspace.yaml` `patchedDependencies`; lockfile `next@15.5.26(patch_hash=…)`. Clean tree (no `node_modules`, no `.next`): frozen install exit 0; the installed package is `next@15.5.26_patch_hash=989560c2…`, the patch reverse-applies, 1 patched line in each react-dom client build. The production chunk served by `/` (`4b76ab8d-….js`) and `framework-….js` contain the rewind (`case 5:…5===r.tag&&null!=r.stateNode&&(…=r.stateNode)`). No manual `node_modules` edit |
| 2 | Deploy build context | REQUIREMENT — deploy blocker, not product code | `deploy.sh` ships `git archive <sha>` (contains `patches/`), but `deploy/Dockerfile` copies only `package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc` before the install. A replica of that step fails (exit 1, `ENOENT … patches/next@15.5.26.patch`), so the build stops loudly and no unpatched image is produced. With `COPY patches ./patches`: exit 0, patched. A real `docker build` was not run: the local Docker could not reach Docker Hub (registry timeout) |
| 3 | IA-P2-02 | PASS | Split harness on the clean-tree build, fresh DB: #418 0 / 150; console errors 0, page errors 0, recoverable 0. Landing / auth 10 / 10, WF05-S04 "never a submit" 10 / 10. Full suite 0 #418 |
| 4 | Clean build | PASS | `format:check`, `lint` (0 warnings), `typecheck`, `build` (0 warnings) in the clean tree |
| 5 | Regression | PASS (see IA-OBS-01) | Unit 237 / 237. DB / API 349 / 349 × 3 (first run 348 / 349, IA-OBS-01). Playwright 664: **640 passed, 24 skipped, 0 failed** (P0-LANDING 8, P0-SHELL 47, WF01 152, WF02 94, WF03 66, WF04 115, WF05 66, shared 110, Internal Alpha 6). Visual 110: 86 passed, 24 skipped. The 24 skips are the only skip in the suite: `PIXEL_QA_SCREENS` opt-in captures, no security case |
| 6 | Fresh DB | PASS | PostgreSQL 17.6; 001→009 applied in order; rerun skips 9 / 9; ledger 9 rows; seed × 2: 31 tables with identical row counts and content hashes; full suite on this DB |
| 7 | Data / security | PASS | REL-SEC 270 cells (9 identities × 30 endpoints, plain = spoofed: IDOR, scope / role spoof, cross-org / project), REL-DATA invariants, workflow SEC / NEG specs. Table diff over the suite: the 22 changed tables are written by the WF01–WF03 workflows under test; `programmes`, `events`, `role_assignments`, `project_domains` unchanged (WF04 / WF05 demos write 0) |
| 8 | Navigation | PASS | REL-NAV: 108 visits, 35 routes, 51 link targets, 0 findings (no `#`, dev, future / WF06, placeholder or technical copy; storage clean). P0-SHELL matrix: 497 rows = 461 × 200 + 36 inert with a stated reason, 0 dead. Refresh, back, logout and revoked session covered in `p0-shell-navigation`; guest → `/auth` / 401 |
| 9 | Visual / responsive | **FAIL** | Pixel at 1440: pixel / typography / segment specs pass (Structural 0, Major 0, Component 0). Responsive: IA-P2-03 below |
| 10 | Privacy / logs | PASS | Server log: 7 startup lines, 0 email / token / cookie / secret / error. Console audit of every page in all 664 tests: 0 JS or page errors, 0 #418. The 282 "Failed to load resource" lines are the negative tests' intended 4xx (211 × 404, 14 × 422, 13 × 409, 10 × 400, 3 × 429, 1 × 403) plus 30 × 500 from error-state stubs (`route.fulfill({ status: 500 })`). 4 preload warnings on `/ops/org/:id` (P3). REL-AUTH / REL-NAV: no token in HTML or API responses; storage holds no email, token or cookie |
| 11 | Defects | **FAIL** | P0 0 · P1 0 · **P2 1 (IA-P2-03)** · P3 as listed in the audit |

## IA-P2-03 — actions unreachable below 1280 px (open)
The check uses only what a real user can do: wheel or swipe over the container, page scroll, then a hit test. Playwright's `click()` scrolls hidden containers programmatically, which is why no spec saw this.

| Control | 1280 | 1024 | 768 | 390 | Cause |
|---|---|---|---|---|---|
| WF03 members list "Mở →" (only way into member detail) | OK | clipped | clipped | clipped | `members.module.css` `.table { overflow: hidden }`: the 969 px table cannot scroll |
| WF02 team "Huỷ lời mời" | OK | clipped | clipped | clipped | `team.module.css` `.table { overflow: hidden }` (1138 px content) |
| WF03 events row "Mở" | OK | covered by the side form's input | OK | OK | `events.module.css` `.page`: fixed 21.375rem side column, no breakpoint |
| WF03 "+ Tạo sự kiện" | OK | OK | OK | covered by the side panel head | same |

Other screens at 768 / 390 overflow the page sideways (e.g. WF02 profile editor +609 px at 768), but every control stays reachable by page scroll and is not covered. Landing, auth, WF04 and WF05 are clean. This corrects IA-L1: member / ops shells are verified usable at **≥ 1280 px**, not 1024. DEC-P0-SHELL-D7 (shells desktop-first, not certified) is context, not a waiver: I cannot downgrade this P2 to P3.

**Remediation (needs an explicit task: the screens are in protected WF02 / WF03):**
1. Let both table wrappers scroll sideways (`overflow-x: auto`, keeping the rounded clip).
2. Give the events page a breakpoint so the side panel stacks instead of overlaying the list and header action.
3. Add a REL-RESP reachability assertion (page / container scroll + hit test, no programmatic scroll) at 1024 / 768 / 390.
4. Re-run this recheck and freeze the SHA.

Alternative: a PO decision limiting Internal Alpha member / ops use to ≥ 1280 px.

## IA-OBS-01 — one unexplained DB-test stall
In the first clean-tree `test:db` run, `membership-request.db-test.ts` "concurrent duplicate requests create exactly one record" hit the 5 s timeout. It normally takes about 20 ms. It did not come back in any later run:
- 3 full re-runs with PostgreSQL lock-wait logging (`deadlock_timeout` 500 ms, later reset): 349 / 349 each, 0 lock waits, 0 deadlocks;
- the file 5 / 5 and the test 6 / 6 in isolation;
- 600 bursts of 5 simultaneous new connections: max 24 ms.

The mechanism is not identified. Recorded as a watch item and re-checked in the next recheck; it is not counted as a pass.

## Files changed
Docs only: this report, `INTERNAL_ALPHA_COMPLETION_AUDIT.md`, `INTERNAL_ALPHA_UAT_MATRIX.md`, `INTERNAL_ALPHA_RELEASE_MANIFEST.md`, `P0_STATUS.md`, `CLAUDE_LATEST_REPORT.md`. No code, test or migration change. Throwaway DB `hubnetwork_rc_fresh` dropped; PostgreSQL settings reset.

## Git
Branch `main`; start HEAD `dcbde62` (checked again before the commit). Report commit: the commit containing this file. Push NOT RUN (LOCAL REVIEW MODE).

## Related
- [INTERNAL_ALPHA_COMPLETION_AUDIT.md](../INTERNAL_ALPHA_COMPLETION_AUDIT.md) — audit
- [INTERNAL_ALPHA_RELEASE_MANIFEST.md](../INTERNAL_ALPHA_RELEASE_MANIFEST.md) — manifest (NOT READY)
- [IA-P2-02_hydration-418.md](IA-P2-02_hydration-418.md) — IA-P2-02
