# ADMIN-PROD-06-qa

**Evidence 11 – 20, 22 and the self-audit.** Parent: [ADMIN-PROD-06-frontend.md](ADMIN-PROD-06-frontend.md).

## 12. Runtime fixture dependency
`grep -rn "localStorage|sessionStorage" src/app/\(ops\)/ops/admin` → no matches. Every screen reads from and writes to the real contracted APIs only (`apiRequest`, 05 §26–28); `ADM_PEOPLE` / `seedAdminFixture` appear only in the test file.

## 13. URL / deep-link behaviour
Every module is its own Next.js route (`/ops/admin/{verification,ventures,access,feedback,categories,accounts}[/:id]`); no client-side-only router. A detail page fetches on mount from the id in the URL — a hard reload or a pasted link behaves identically to a nav click (proven: the verification detail test navigates straight to `/ops/admin/verification/{id}` with no prior nav click). Filtered queue state (status/type/priority/…) lives in component state, not the URL — acceptable for this task (no contract requires filter-preserving deep links); flagged for PROD-07 as a possible enhancement, not a defect.

## 14. Loading / empty / error / permission
Every list and detail: `loading` (a label, `aria-busy`), `empty` (a specific sentence, never a blank table), `failed` (retry button), `denied` (403 → "Bạn không có quyền với mục này", no data hint), `not_found` (404 → "Không tìm thấy hoặc ngoài phạm vi", identical for unknown / malformed / out-of-scope ids), and a 401 mid-session → the sign-in link (`SessionExpired`). All five states are one shared implementation (`shared.tsx`: `AdminLoadFailure`, `classifyAdminError`), so every module answers identically — not six bespoke error paths.

## 15. Responsive smoke
1440 / 1024 / 768 checked for zero horizontal overflow on the Admin Home and the Feedback queue (representative: a KPI grid and a filter bar, the two layouts most likely to overflow). 390 is smoke-only per the task: the page loads (200) and renders; the fixed 216px `OpsShell` sidebar has no responsive collapse at any width and is pre-existing, shared, WF03-authored shell debt — not solved here, classified separately for PROD-07 / the OpsShell owner.

## 16. Accessibility smoke
Every control is a labelled `<button>`/`<input>`/`<select>` with visible or `aria-label` text (no icon-only controls); status/error text uses `role="alert"` or `role="status"`; the active nav item and the active category tab carry `aria-current`; loading regions carry `aria-busy`. Confirm flows (reject, decline, revoke, the direct account actions) are an inline form, not a modal — the same idiom WF03's `organization-relationships.tsx` already uses, so keyboard flow (tab to the field, tab to Confirm/Cancel) is unchanged. No accessibility redesign attempted.

## 17. Security rendering
No hidden org scope, raw account id, token or internal audit payload is rendered anywhere: feedback screenshots show the `expired`/`url` the server already decided (never the asset id when expired); account requests show only the target's **profile** id (never the account id, matching PD-7); grants show profile ids and capability codes the server returned, never a raw `role_assignments` row. The reject/decline/triage forms never echo back anything the server didn't send. Covered concretely by the frontend spec's console/network assertions (below) across every screen.

## 18. Targeted tests
`tests/visual/specs/admin-prod-06-frontend.spec.ts` — 14 tests, real DB-backed fixtures (`fileVerificationRequest`, `submitVentureForReview`, `grantAccess`/`revokeAccess`, `requestAccountDeletion`, direct feedback/vocabulary rows — the same writers each domain's own `*.db-test.ts` uses, never a mock): navigation by capability (incl. the capability-only grantee gap-fix), verification queue/detail/approve/reject, venture queue/detail/diff/reject, access grant/revoke (PD-6 reach), feedback queue/triage/weekly-summary/expired-screenshot, category rename/archive/VENTURE_STAGE-no-archive, account-request decline-reason-required/direct-actions/self-hidden, responsive smoke (×2). `src/lib/admin/access-api.db-test.ts` +3: `listDelegationOrganizations` scope, reach and refusal.

## 19 – 20. Protected regression, console / hydration / 5xx
Full suite on the final build, fresh DB + QA vocabulary fixture: **87 specs, 1164 tests, 1138 passed, 0 failed, 0 flaky, 26 skipped** (`pixel-qa-screens.spec.ts` ×24 needs `PIXEL_QA_SCREENS`; `wf06-prod-library.spec.ts` ×1 needs `WF06_FEED_DOWN`; `wf06-prod-qa.spec.ts` ×1 needs `WF06_QA_FEED=crafted` — all pre-existing, environment-gated, unrelated to this task). `REL-NAV navigation graph` (crawls every link as guest/member/leader/admin, refusing `#`/placeholder/dev/future copy) and `REL-SEC cross-workflow actor matrix` both passed unchanged, independently covering the new Admin nav. Every Playwright spec (including every WF01–WF06, auth, shared-shell, RBAC, admin-API and this new frontend spec) already asserts zero browser console errors and zero 5xx per test (`page.on('console'|'pageerror'|'response')`); none of that changed. Gates: format · lint · typecheck PASS · unit 37 / 367 · DB 47 / 746 (`pnpm test:db`, fresh reset) · build PASS.

## 22. Bugs found / fixed (found while writing this task's own tests)
| # | Issue | Fix |
|---|---|---|
| 1 | A fast tab switch in Categories could let a slower response for the previous type overwrite the new tab's list (a real stale-data bug, not just a flaky test) | `useRequestGuard` (`shared.tsx`): every queue load is token-guarded; a superseded response is discarded. Applied to all four filtered queues (verification, ventures, feedback, accounts) and categories |
| 2 | Archiving a category flashed the whole table through a loading state, which also made the clicked row's own button vanish mid-interaction | `load(silent)`: an in-place refresh after a row's own mutation keeps the table mounted; only the first load / tab switch shows the loading state |
| 3 | A stray `vocabulary_items` row left ARCHIVED by an earlier (pre-fix) test run — `vocabulary_items` has no per-test fixture reset | Restored manually (`UPDATE … SET status='ACTIVE'`); the test itself is self-restoring (archive → activate) so repeat runs stay clean |

## Self-audit
| Check | | Check | |
|---|---|---|---|
| existing OpsShell reused | ✓ | real APIs only | ✓ |
| no runtime fixtures | ✓ | verification UI complete | ✓ |
| Venture public vs pending clearly separated | ✓ | delegation scope safe (server-determined) | ✓ |
| feedback lifecycle correct | ✓ | category UI lightweight | ✓ |
| no hard-delete UI | ✓ | deletion rejection reason required | ✓ |
| permission-based nav correct | ✓ | loading / empty / error covered | ✓ |
| responsive acceptable | ✓ | no private-field leakage | ✓ |
| protected regression GREEN | ✓ | no push · no merge · no deploy | ✓ |
| PROD-07 not started | ✓ | | |

## Related
- [ADMIN-PROD-06-frontend.md](ADMIN-PROD-06-frontend.md) · [ADMIN-PROD-06-modules.md](ADMIN-PROD-06-modules.md) · [ADMIN-PROD-06-prod07-handoff.md](ADMIN-PROD-06-prod07-handoff.md)
