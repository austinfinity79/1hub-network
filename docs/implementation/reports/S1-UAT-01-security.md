# S1-UAT-01 security

Security, responsive, regression and git evidence for S1-UAT-01, on final HEAD `d502f9a` (build `QvOf9LgLv8WH-IyfrqitG`), isolated DB `hubnetwork_s1auth`. Matrix: [S1-UAT-01-evidence](S1-UAT-01-evidence.md).

## Final security check
| Check | Evidence | Result |
|---|---|---|
| Password hash never exposed | `password_hash` read / written only in `credentials.ts`; DTOs = consume shape; error-envelope test (no `scrypt:` / `password_hash` in any auth answer); server log 0 hits | PASS |
| Reset token never logged | token in URL fragment only, SHA-256 at rest; server log 0 `token=` / `#token=`; audit asserts no token / password | PASS |
| OAuth secret never logged | server-only env; unit test: provider failure logs neither secret nor code; server log 0 hits | PASS |
| Account existence not leaked | see enumeration table in the evidence file; neutral sign-up refusal; decoy lockout | PASS (residual: a sign-up that does not complete implies a conflict; closing it needs verify-before-account, a product change) |
| No session fixation | DB: three sign-ins → three distinct tokens; browser: pre-set `1hub_session` never adopted | PASS |
| Reset invalidates other sessions | DB + browser (device B → 401 after reset), same transaction as the hash | PASS |
| OAuth state enforced | forged / missing / replayed state → 400 `AUTH_GOOGLE_STATE_MISMATCH`, cookie cleared every outcome, PKCE S256 | PASS |
| Direct API bypass blocked | text/plain and form POSTs to login / register → 400, no cookie; BLOCKED / DEACTIVATED refused by every method; REL-SEC actor matrix green | PASS |
| Controlled 4xx / 429 contract | 400 / 401 / 403 / 409 / 422 / 429 envelopes only; injection-shaped input → controlled 401 | PASS |
| Unexpected 5xx | 0 `api unexpected error` in the server log across 1213 + 19 tests | PASS (one dev-only `/dev/login` harness stack for a BLOCKED persona: pre-existing, 404 in production) |
| Restart | session still valid and lockout still 429 after a server restart (state is in PostgreSQL) | PASS |

## Responsive (final build)
| Screen / state | Widths | Result |
|---|---|---|
| `/auth` sign-in, create account, forgot | 1440 · 768 · 390 | no overflow, no control clipped, password "Hiện" on the label row, Google CTA usable |
| `/auth` (guest redirect) layout-safety detector | 1440 · 1024 · 768 · 430 · 390 · 320 | 0 overflow / escape / overlap / clipped |
| `/auth/reset-password` | 1440 · 768 · 390 | no overflow, fields and CTA intact |
| REL-RESP sweep (auth key = identifier field) | 1440 · 768 · 390 | PASS |
| Validation / error text | 1440 · 390 | readable, inside the card |

## Protected regression (final build, isolated DB)
| SPEC_COUNT | TEST_COUNT | PASS | FAIL | SKIP | FLAKY |
|---|---|---|---|---|---|
| 92 | 1213 | 1184 | 0 | 29 | 0 |

Skips (all opt-in / env-gated, unchanged from ADMIN-PROD-08): `pixel-qa-screens` 24 (`PIXEL_QA_SCREENS`), `admin-design-01-capture` 2 (`ADMIN_DESIGN_CAPTURE`), `admin-prod-08-pixel` 1 (`ADMIN_PIXEL_QA`), `wf06-prod-library` 1 and `wf06-prod-qa` 1 (crafted / unreachable feed modes).

L1–L2 UAT subset (`tests/uat/uat.config.ts`): 19 / 19 — **TECHNICAL_UAT_PASS**. **BUSINESS_UAT_NOT_YET_RUN** (the formal Sprint1 Business UAT is a later gate).

## Git
| Field | Value |
|---|---|
| Branch | `feat/s1-uat-01-auth` (worktree `../1hub-network-s1-auth`) |
| Start HEAD | `edd3d24` = `origin/main` (`git ls-remote`), unchanged during the task |
| Implementation commits | `1ac26b0` feat, `d502f9a` fix |
| Report / final commit | the docs commit after `d502f9a` (SHA in the task reply) |
| Remote | `origin`; push NOT RUN (task: no push, no merge, no deploy) |
| Production | `78f21f2` per P0_STATUS and the task contract; not touched, not re-verified against the live server |

## Related
- [S1-UAT-01-evidence](S1-UAT-01-evidence.md)
- [S1-UAT-01-auth-replacement](S1-UAT-01-auth-replacement.md)
- [S1-UAT-01-db-incident](S1-UAT-01-db-incident.md)
