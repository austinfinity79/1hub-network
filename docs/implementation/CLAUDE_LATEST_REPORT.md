# Claude Task Report

## Task
PRE-PROVISION 3 INTERNAL ALPHA LOGIN ACCOUNTS. Full report: [reports/TASK-22-PREVIEW-PROVISION_alpha-accounts.md](reports/TASK-22-PREVIEW-PROVISION_alpha-accounts.md).

## Verdict
**DONE.** The three operator-supplied addresses (masked: `g***@1hub.network`, `t***@gmail.com` × 2) have one ACTIVE account each on https://1hubnetwork.io.vn, onboarding incomplete, no elevated permission. Each passes the invite-only check: `POST /api/v1/auth/magic-link` → 202, Resend accepted.

## Scope implemented
- Operator command `provision-account.sh` / `.mjs` on `deploy/vps-foundation` `1f558d6`: account + `account_created` through the app's own modules, idempotent.
- Provisioning run twice on the server (CREATED × 3, then ALREADY EXISTS × 3); eligibility and permission checks.

## Files changed
- `main`: this report, the task report, `INTERNAL_ALPHA_PREVIEW_RELEASE.md` (how to provision), `P0_STATUS.md`.
- `deploy/vps-foundation`: `1f558d6` (command), `8e0335b` (`VPS_DEPLOYMENT.md` command row, deployment record).

## Migrations / data
No migration or schema change. Data: 3 `user_accounts` rows + 3 `account_created` events; 3 magic-link requests from the eligibility check. One tester has since signed in (`/onboarding/purpose`).

## Tests
Local run of the command against the dev database (idempotency, case-insensitivity, refusal); server verification queries; public endpoint 202 × 3.

## Visual QA
Not applicable.

## Deviations / blockers
- No existing account-only mechanism: roster import needs an organisation membership, and the link wrapper allows `@example.test` only. Added the minimal operator command above instead of a raw SQL insert.
- Blocking gaps: 0.

## Git
- Branch: `main`; start HEAD `2dc6c7e`, checked again before the commit
- Implementation commit: `deploy/vps-foundation` `1f558d6` (tooling only; the app stays `5a195f7`)
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN**; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
Real-email sign-in by the three testers. Not started automatically.
