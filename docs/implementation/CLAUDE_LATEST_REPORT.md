# Claude Task Report

## Task
TASK 22-HOMEPAGE-FINAL-DEPLOY — MERGE EXACT HOMEPAGE ALIGNMENT + DEPLOY. Full report: [reports/TASK-22-HOMEPAGE-FINAL-DEPLOY_homepage-deploy.md](reports/TASK-22-HOMEPAGE-FINAL-DEPLOY_homepage-deploy.md).

## Verdict
**DEPLOYED GREEN (homepage). Overall release NOT READY.** `3fd00e4c30103aa6ffcc36753c6b5f11324948e9` (tag `internal-alpha-preview-07`) runs on https://1hubnetwork.io.vn. The edge blockers (HTTP/3, Referrer-Policy, health check) remain.

## Scope implemented
- Freeze, backup, deploy of the exact homepage commit; its parent is the previously deployed `2033264`, so no merge was needed.
- Domain verification: content, pixel equality with the verified local render, navigation, responsive, preserved product, auth smoke, restart, rollback readiness.

## Files changed
- Docs only: this report, `reports/TASK-22-HOMEPAGE-FINAL-DEPLOY_homepage-deploy.md`, `INTERNAL_ALPHA_PREVIEW_RELEASE.md`, `P0_STATUS.md`. No product code.

## Migrations / data
None. Migrate 9 × skip. Backup `onehub-20260928T152004Z.dump`. Smoke rows only (one onboarding persona, links, sessions).

## Tests
Targeted specs 131 / 131 on a build of the exact sources. Homepage evidence of `3fd00e4`: format, lint, typecheck, build PASS; unit 257 / 257; regression 191 / 191.

## Visual QA
Domain capture = local capture, 0 differing pixels (1440 × 12636); pixel P0 / P1 / P2 = 0 against the reference. Responsive 1440 / 1024 / 768 / 390 clean on the domain.

## Deviations / blockers
- HTTP 5xx during verification: 2 × 504 on `/_next/image` right after the deploy (empty image cache, not reproduced; FU-IMAGE-CACHE) and 1 × 502 on `/health` during the planned restart. 0 after 15:31 UTC.
- Open release blockers: EDGE-H3-POST-RESEND; external: Referrer-Policy, monitor endpoint. Legal is closed.
- The real inbox click was not part of this task; the request was accepted by Resend.

## Git
- Branch: `main`; start HEAD `83b2e12`, checked again before the commit
- Implementation commit: `3fd00e4c30103aa6ffcc36753c6b5f11324948e9`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **PASS** (2026-09-28, on PO request): `main` fast-forwarded `0b4095f` → `af1185a`, 109 commits, no force; remote SHA compared with the local SHA. This report's own commit is pushed right after
- Remote HEAD: `af1185a39e864d6082c3b7ae34440f60c13da5b1` before this commit
- Also pushed on PO request (2026-09-28): new remote branch `deploy/vps-foundation` at `e89f5e35997c482a3007655ac0f32c50311e995f` and the tags `internal-alpha-preview-01…07`; every remote ref compared with the local one. Scanned before the push: no secret, no real address, screenshots show demo personas only
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
The OneShield changes (HTTP/3 off, Referrer-Policy, health check path), then the auth transport re-test and the real inbox login. Not started automatically.
