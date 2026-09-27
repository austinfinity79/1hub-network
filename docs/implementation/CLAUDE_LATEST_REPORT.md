# Claude Task Report

## Task
PREPARE INTERNAL ALPHA TEST PACK — test accounts, test data / reset, 6-workflow self-review guide. Full report: [reports/INTERNAL-ALPHA_test-pack.md](reports/INTERNAL-ALPHA_test-pack.md).

## Verdict
**DONE** — docs only. Team UAT: **PENDING**.

## Scope implemented
| Item | Result |
|---|---|
| Test actors | Guest; new member (own new address, or `newcomer@` once); `member@` (Demo Member, Demo Startup owner); PROJECT owner and ACTIVE team member created through the product (missing in the seed); `leader@` (Chapter 01 Chapter Leader, pending Demo Startup invitee); `ops@` (platform admin); `pending@` (unrelated) |
| Sign-in | Operator one-time link `issue-login-link.sh <address>@example.test` (15 min, single use); no email provider |
| Reset | Private window; WF04 / WF05 "Đặt lại demo"; session rows; operator-only reseed (backup first) |
| Guides | WF-TEST-01..06 with steps, expected results, routes, negative checks; PO checklist; results template |
| Verification | Real domain signed out (read-only); signed-in steps replayed on the same release and seed locally; 0 dead instructions |

## Files changed
`docs/uat/` (5 files + `self-review/` 6 files, new), `docs/implementation/reports/INTERNAL-ALPHA_test-pack.md` (new), `P0_STATUS.md`, this report.

## Migrations / data
None. Runtime code 0; the deployed release and its DB untouched.

## Tests
Not applicable (docs). Verification replays: all six journeys passed on the mirror; 0 page or console errors.

## Visual QA
Not applicable.

## Deviations / blockers
- Signed-in steps were not run on the real domain (operator links need server access; not used in this docs task).
- The prompt's release SHA had a typo; the deployed SHA is `9c614585ca61fe2e4c957f28d7cc5c78fafe7bc0`.

## Git
- Branch: `main`; start HEAD `652c383` (checked again before the commit)
- Implementation commit: none
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
PRODUCT OWNER SELF-REVIEW with the test pack, then ALPHA-AUTO-REVIEW-01 / TEAM UAT as agreed. Not started automatically.
