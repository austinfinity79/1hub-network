# Claude Task Report

## Task
TASK 22-PREVIEW-AUTH — REAL E-MAIL MAGIC LINK THROUGH RESEND, INVITE-ONLY. Full report: [reports/TASK-22-PREVIEW-AUTH_real-email.md](reports/TASK-22-PREVIEW-AUTH_real-email.md).

## Verdict
**GREEN.** Domain `1hubnetwork.io.vn` verified in Resend; the three server variables are present. A provisioned address receives the existing one-time link by e-mail (`https://1hubnetwork.io.vn/auth/callback?token=…`); an unknown address gets a notice, no token and no account. Frozen as NEW APP PREVIEW SHA `5a195f72acf05dd6537b6c70ad185e0737acd916` (login UI hotfix + real e-mail login). Not deployed.

## Scope implemented
- Resend adapter, e-mail template, link origin, dev outbox (local / CI only).
- Invite-only request check, rate limits (10 per address, 30 per IP, per 15 minutes), form notice.
- DEC-AUTH-EMAIL D1–D4; error codes `AUTH_ACCOUNT_NOT_PROVISIONED` (403), `AUTH_EMAIL_DELIVERY_FAILED` (500).

## Files changed
- New: `src/lib/email/resend.ts`, `src/lib/auth/{magic-link-email,provisioning,rate-limit}.ts`, `src/app/dev/outbox/route.ts`, unit / DB tests, `tests/visual/specs/wf01-email-magic-link.spec.ts`.
- Updated: magic-link request / resend routes, `magic-link.ts`, `auth-entry-form.tsx`, `error-codes.ts`, `.env.example` (key empty), `DECISION_LOG.md`, WF01-S01 / S02 specs.
- Docs: this report, the task report, `INTERNAL_ALPHA_PREVIEW_RELEASE.md`, `P0_STATUS.md`.

## Migrations / data
None. Real delivery was checked with a temporary local account for Resend's test sink, removed afterwards.

## Tests
Format, lint, typecheck PASS; unit 245 / 245; DB 354 / 354; targeted regression 239 / 0 failed; production build PASS; #418 = 0; 0 HTTP 5xx; secret scan 0.

## Visual QA
AUTH1 / AUTH2 pixel tests pass inside WF01 (the only UI change is the new notice text).

## Deviations / blockers
- Human inbox receipt is part of the post-deploy smoke: the e-mailed link targets the public domain.
- Invite-only supersedes the API 05 §4.1 no-disclosure rule for this endpoint (PO instruction, DEC-AUTH-EMAIL-D1).

## Git
- Branch: `main`; start HEAD `6d6947b`, checked again before each commit
- Implementation commit: `5a195f72acf05dd6537b6c70ad185e0737acd916` (local tag `internal-alpha-preview-03`)
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN**; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
Claude B deploys `5a195f7` (rollback `cc6ca28`) and runs the smoke in the preview release manifest. Not started automatically.
