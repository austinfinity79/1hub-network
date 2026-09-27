# Claude Task Report

## Task
PREPARE INTERNAL ALPHA TEST PACK — test accounts, test data / reset, 6-workflow self-review guide. Docs only. Domain https://1hubnetwork.io.vn, deployed release `9c614585ca61fe2e4c957f28d7cc5c78fafe7bc0`.

The prompt spelled the release SHA with 41 characters (`…c78fa7ef7bc0`). The deployed and frozen SHA is `…c78fafe7bc0`; the Task 20 record says the same.

## Verdict
**DONE.** Pack in [docs/uat/](../../uat/INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md). Team UAT: **PENDING**. Runtime code 0, DB / schema 0, release unchanged.

## What was prepared
| Document | Content |
|---|---|
| `docs/uat/INTERNAL_ALPHA_TEST_ACCOUNTS.md` | Operator sign-in procedure (`issue-login-link.sh`, `@example.test` only, single use, 15 min); actor matrix A–I; 2 missing actors covered by product flows |
| `docs/uat/INTERNAL_ALPHA_TEST_DATA_RESET.md` | Fixture inventory; reset methods A–E; operator-only reseed with what it restores and keeps |
| `docs/uat/INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md` + `docs/uat/self-review/*.md` | Status labels (production-like / DEMO / FUTURE), known limitations, WF-TEST-01..06 step tables with negative checks |
| `docs/uat/INTERNAL_ALPHA_UAT_CHECKLIST.md`, `docs/uat/INTERNAL_ALPHA_UAT_RESULTS_TEMPLATE.md` | PO checklist (PASS / FAIL / BLOCKED / NOT TESTED, P0–P3) and issue log |

## Verification
| Source | Checked |
|---|---|
| Real domain (read-only GET, signed out) | Landing headline, header and CTA labels; `/auth` form; `/auth/error`; public Chapter 01 and HUB pages; legal links → 404 (known); every signed-out member / ops / demo URL → `/auth` |
| Local mirror: release code (`git diff 9c61458` empty for code) + the same seed | Every signed-in step of WF-TEST-01..06 replayed by visible labels. Sign-in links came from the operator tool's code path (`requestMagicLink`). 0 page or console errors |
| Findings used in the guide | No email is sent (the operator link is the only sign-in); the in-product sign-out is "Đăng xuất khỏi mọi thiết bị" (affects every session of the account); invitations are shared by page address ("Chưa có email nào được gửi"); there is no venture archive action, so that check is not UI-testable; a reseed does not fully reset `newcomer@` |

Signed-in steps were not run on the real domain: that needs operator links on the server, which this docs-only task did not use. The Task 20 smoke covered the same workflows there.

## Git
Branch `main`; start HEAD `652c383`; docs-only commit. Push NOT RUN (LOCAL REVIEW MODE).

## Related
- [../../uat/INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md](../../uat/INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md) — guide
- [INTERNAL-ALPHA_release-freeze.md](INTERNAL-ALPHA_release-freeze.md) — release freeze
