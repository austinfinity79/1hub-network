# INTERNAL-ALPHA Post-Deploy Test Pack

**POST-DEPLOY INTERNAL ALPHA TEST PACK PREPARATION: DONE.** Docs only.
- Domain https://1hubnetwork.io.vn.
- Release `9c614585ca61fe2e4c957f28d7cc5c78fafe7bc0` (Task 20, deployed GREEN); rollback `0a2df094b941f6d0f0fc87cdb7767b2e92272198`.
- Runtime, business logic, DB / schema, product UI and deploy: 0 changes. Team UAT: **PENDING**.

The prompt spells the release SHA with 41 characters (`…c78fa7ef7bc0`), which is not a git object. The deployed and frozen SHA is `…c78fafe7bc0`, the same as the Task 20 record.

## Documents
| Document | Content |
|---|---|
| `INTERNAL_ALPHA_TEST_ACCOUNTS.md` | Operator sign-in method (single-use 15-minute links, `@example.test` only); actors A–I with account, role / organisation, venture, programme, starting state, flows; missing actors; caveats |
| `INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md` | PRODUCTION / DEMO / FUTURE labels; the six flows; a 10-check × 6-flow checklist with flow and final verdicts (PASS / PASS WITH ISSUE / FAIL) and notes; limitations; verification |
| `internal-alpha/*.md` (6) | Flows 1–6 in one format: Flow ID, purpose, classification, actor, account, precondition, start URL, steps with expected results, negative checks, reset, PASS criteria, limitation |
| `INTERNAL_ALPHA_TEST_DATA_RESET.md` | Data inventory with reset behaviour; persistent vs browser-session state; tester reset methods A–F; never-do list; TECHNICAL RESET (operator only) |

- **Previous pack:** `docs/uat/` (`2d19cad`, same release). Its 11 files are now pointers to the new location, so there is one source of truth.
- **Updated references:** `P0_STATUS.md` and `docs/design-revision/07` link to the new files.

## Actors
| Actor | Account | Status |
|---|---|---|
| A Guest | — | Available |
| B New member | own new address (or `newcomer@`, once) | Available |
| C Member | `member@example.test` | Available |
| D Project / Startup owner | `member@example.test` (Demo Startup) | Available; PROJECT type made in Flow 3 |
| E ACTIVE team member | own address, invited and accepted in Flow 3 | **MISSING in the seed**; made through the product |
| F Pending invitee | `leader@example.test` (Demo Startup, "Contributor") | Available |
| G Community Leader | `leader@example.test` (Chapter 01 leader) | Available |
| H Platform Admin | `ops@example.test` | Available |
| I Unrelated member | `pending@example.test` | Available |

## Verification of the domain (read-only, signed out, 2026-09-28)
| Check | Result |
|---|---|
| Public routes | `/`, `/auth`, `/auth/check-email`, used / expired / generic sign-in states, `/organizations/hub-network`, `/chapter-01`, `/club-01`: 200 |
| Protected routes signed out | `/me`, `/me/*`, `/onboarding/purpose`, `/projects/new`, `/ops/network`, `/demo/projects`, `/demo/programmes`: 307 → `/auth` |
| Rendered copy | Landing headline; `/auth` "Vào HUB NETWORK" / "Gửi link đăng nhập"; "Link đã dùng rồi", "Link đã hết hạn", "Chưa đăng nhập được"; Chapter 01 page lists Demo Event and Club 01 and hides the draft event; 404 "Không tìm thấy trang"; legal links 404 (known) |
| Health | 0 console errors; no sideways scroll on landing / auth at 1440 and 390; 0 `href="#"` |
| Header | Sign-in callback `Referrer-Policy: strict-origin-when-cross-origin` (CDN override, accepted limitation) |
| Deployed ≠ repository | The live UI is the release; TASK 22.1–22.3 in the repository are not deployed, so the pack follows the release (one-form Project / Startup create, not the wizard) |

- No sign-in and no data change on the domain.
- Signed-in steps come from the previous pack's replay on a local copy of the same release and seed, plus the Task 20 deployment smoke.

## Blocking gaps
None. Actor E is missing from the seed but is produced by Flow 3 in the product.

## Git
Branch `main`; start HEAD `d06d49e`; docs-only commit. Push: **NOT RUN**.

## Related
- [../INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md](../INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md) · [INTERNAL-ALPHA_test-pack.md](INTERNAL-ALPHA_test-pack.md)
