# ADMIN-PROD-06-frontend

**ADMIN-PROD-06 — Admin Portal frontend inside the existing OpsShell (IMPLEMENT, no new shell).** Evidence 1 – 10. Uses only the real, frozen APIs: [05 §26 (A9)](../../architecture/05_API_CONTRACT_P0_v1.0.md) role verification, §27 (A10) venture review + access, §28 (A11) feedback / categories / accounts. Companions: [modules](ADMIN-PROD-06-modules.md) · [QA](ADMIN-PROD-06-qa.md) · [PROD-07 handoff](ADMIN-PROD-06-prod07-handoff.md).

## 1. Preflight
`feat/admin-portal` at `f2845a0` (ADMIN-PROD-05-FIX), tree clean except `AGENTS.md`, HEAD unchanged until the commit; migrations 001 – 017 intact; origin/main and production `78f21f2`; no concurrent writer. Read: ADMIN-PROD-01 frozen contract, the PROD-03/04/05 API handoffs, the existing OpsShell (`ops-shell.tsx`, `ops-nav.tsx`, `nav.ts`, `guard.ts`), the WF03 screen conventions (member-detail, org-relationships, dashboard) and the design tokens. No ADMIN-DESIGN-01 pixel reference exists for these six screens; pixel QA is PD-8's ADMIN-PROD-08, not this task.

## 2. OpsShell reuse
No new shell, nav framework, auth or role logic. `OpsShell` gets two new optional props (`adminCapabilities`, `hasNetworkAccess`), both defaulting to the prior behaviour — every existing `/ops/network` and `/ops/org/*` call site is byte-identical. The six modules live under one new route tree, `/ops/admin/*`, sharing the same `<OpsShell>` component, nav list markup (`OpsNav`) and CSS classes (`.group`, `.items`, `.item`) as WF03 already uses — no duplicated sidebar, no second router.

## 3. Admin navigation
`requireOpsAdmin()` (`src/lib/ops/guard.ts`) is the new entry check: any of the six capabilities, platform-wide or on one organization, same 404 as holding none. This is deliberately **not** `requireOps` (`network:read`): a PD-6 capability-only grantee (e.g. `verification:review` on one CLB, no whole role) could not reach `/ops` at all before this task (the PROD-05 handoff gap) — now they reach exactly their one queue. "Danh sách tổ chức" hides for that one case (`hasNetworkAccess`) rather than linking to a 404. Each of the six items, plus "Tổng quan quản trị", shows only when its own capability is held (`ADMIN_NAV_ITEMS`, `src/lib/ops/nav.ts`); no dead navigation.

## 4 – 8. The six modules
See [ADMIN-PROD-06-modules.md](ADMIN-PROD-06-modules.md) for verification, venture review (public-vs-pending, the diff), organization access, feedback and categories.

## 9. Account Ops UI
`/ops/admin/accounts`: the account-request queue (PLATFORM_ADMIN, `account:administer`) — leader escalations and users' own deletion requests, filtered by status/kind. Detail: Process / Decline; declining a deletion request (SELF_DELETION or a SOFT_DELETE escalation) requires a reason (DEC-ADM-PD7.1) — the submit button stays disabled until one is typed, never a silent 422. Direct LOCK / UNLOCK / DEACTIVATE / REACTIVATE on the request's target account reuse the same confirm-form idiom, each naming its effect; hidden entirely for the viewer's own account (`ownProfileId`, read from `GET /session`) and for a request with no profile. No hard-delete control exists anywhere, and none is possible — the account-ops API has no such endpoint. No account search / directory was built: there is no `GET /ops/accounts` listing API, and building one would be scope expansion; every target account is reached through a real request, matching "real APIs only."

## 10. Permission matrix (display only; every call re-authorizes)
| Actor | `/ops/admin` | Verification | Ventures | Access | Feedback | Categories | Accounts |
|---|---|---|---|---|---|---|---|
| PLATFORM_ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Whole-role leader (any level) | ✓ (network only) | ✓ (own + fallback) | — | ✓ (own + children) | — | — | — |
| Capability-only `verification:review` grantee | ✓ (no network link) | ✓ | — | — | — | — | — |
| Member / guest | 404 everywhere | | | | | | |
`access:delegate` is never delegable alone (DEC-ADM): every non-platform holder reached it through the whole role, so always also holds `network:read` there.

## Related
- [ADMIN-PROD-06-modules.md](ADMIN-PROD-06-modules.md) · [ADMIN-PROD-06-qa.md](ADMIN-PROD-06-qa.md) · [ADMIN-PROD-06-prod07-handoff.md](ADMIN-PROD-06-prod07-handoff.md) · [ADMIN-PROD-05-prod06-handoff.md](ADMIN-PROD-05-prod06-handoff.md)
