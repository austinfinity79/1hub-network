# WF05-PROD-05_matrices

**WF05-PROD-05 — QA matrices (evidence items 2–18).** Sources: Q `wf05-prod-qa.spec` (new), F `wf05-prod-frontend.spec`, P `wf05-prod-api.spec`, U `wf05-uat-journey.spec`, L `l5-startup-journey.spec`, H `application-hardening.db-test`, A `application.db-test`, I `application-integrity.db-test`, K `idempotency.db-test`, R `scripts/qa/wf05-restart-check.mjs`. Main report: [WF05-PROD-05_functional-security-qa.md](WF05-PROD-05_functional-security-qa.md).

## Functional (happy paths)
| Journey | Result | Source |
|---|---|---|
| PROJECT owner: QuickTeam create → WF02 edit → S02 apply → save → refresh → relogin (`/auth?redirect`) → resume → submit → S02 "Xem đơn" → SUB3 | PASS: one venture, one application, same ids; snapshot unchanged by a later venture edit | Q |
| STARTUP owner: the same journey | PASS | Q |
| owner drafts, double-click submit, read only everywhere | PASS | F, U, L |

## Negative paths (Q matrix, rows compared before / after: unchanged)
| Case | Status |
|---|---|
| guest create / save / submit | 401 |
| non-owner save / submit; team member save; foreign read / update / submit; foreign venture in body; invalid venture / programme / application; spoofed `x-account-id` / `x-owner-profile-id` / `x-role` | 404 |
| team member create (owner-only) | 403 `SCOPE_FORBIDDEN` |
| CLOSED create / ARCHIVED create | 404 |
| CLOSED or ARCHIVED edit / submit | 409 `APPLICATION_NOT_ELIGIBLE` |
| SUBMITTED edit / resubmit | 409 `APPLICATION_SUBMITTED` |
| SUBMITTED or DRAFT delete, PUT | 405 (no such method; framework) |
| invalid answer; `owner_profile_id`, `created_by_account_id`, `status` in a body | 422 |
| missing required answer at submit | 422 `APPLICATION_INCOMPLETE` |
| duplicate application | 409 `APPLICATION_EXISTS` (+ existing id) |

## RBAC / IDOR
| Manipulation | Result | Source |
|---|---|---|
| venture id (foreign, unknown, malformed 36-char) | 404, unchanged | Q, P, H |
| application id (foreign draft / submitted) | 404 | Q, P |
| programme id (unknown, closed) | 404 | Q, P |
| `owner_profile_id`, `created_by_account_id`, `primary_applicant_type`, `status` in body | 422 `not_accepted` | Q, P, H |
| identity / role headers | ignored (404 for the stranger) | Q, P |
| EDIT / VIEW members | create 403, read / save / submit 404, not listed | P, H, F |
Hidden resources answer 404; a visible venture's owner-only action answers 403; data unchanged in every case. No check relies on the UI.

## Lifecycle
| State | Create | Edit | Submit | Owner read |
|---|---|---|---|---|
| programme PUBLISHED | yes | DRAFT only | once | yes |
| programme CLOSED | 404 | 409 | 409 | draft read only, snapshot |
| programme ARCHIVED (compatibility) | 404 | 409 | 409 | 200, read only |
| application SUBMITTED | — | 409 | 409 | snapshot only |
No reopen, withdraw, resubmit or amend path exists (no endpoint; DB guard 016 on SUBMITTED). Sources: Q, P, H, I.

## Idempotency / retry
| Case | Result | Source |
|---|---|---|
| create, same key + same body | 201 replayed, one row | P, A |
| same key + different body | 409 idempotency conflict | P |
| repeated create without key | 409 `APPLICATION_EXISTS` | P, Q |
| repeated save | same state; no second audit row | P, H, Q |
| repeated submit, same key (network retry) | 200 replay, identical body, one audit | Q, P |
| refused submit, then the same key once complete | 200 (no permanent lockout: a failed attempt rolls its claim back) | Q, K |
| expired key | purged with stored answers; treated as new | K |

## Concurrency
Two creates → one DRAFT + `409 EXISTS`; two submits → one SUBMITTED + `409`; save racing two submits → one SUBMITTED, one audit; stale draft save after submit → `409`, the form opens SUB3; registration change racing a create waits, then refuses; 12 creates on a pool of 10 → 12 / 12. No partial transaction, no duplicate row. Sources: H, P, U, F.

## Form / application integrity
The application references `programme_application_forms` (no WF05 copy of the schema); `question_set_version` equals the form version (F); a form with applications cannot change (H, G10); the snapshot (`schema_version` 1) is written once and never changes (I, A, Q); questions are WF04's plain-text structure, no Q3(b) operator-authored questions added.

## Cross-WF, auth, frontend, security, persistence
| Area | Result | Source |
|---|---|---|
| WF02 → WF05 | settings → entry → S01 → S02 → WF02 editor → back: same id, one row, owner and members unchanged | F, Q |
| WF04 → WF05 | apply → draft → submit; operator closes via WF04: both CLOSED, same programme / form / application; history read only | F, Q, P |
| auth / session | guest deep links → `/auth?redirect=<path>` (6 routes); revoked session on read or save → same; private application readable after relogin | F, Q |
| frontend states | loading, empty, error + "Thử lại", 403 / 404, read only ("Chỉ xem"), submitted, closed rows; no blank page, stuck spinner or enabled CTA the API refuses | F, S01 / S02 specs, L |
| leakage | refusals: envelope only, no stack / SQL / constraint; snapshot and lists: no e-mail, account id, session token, answers in lists; audit rows: no answer text; server log: no body | Q, P, H, server log |
| restart / persistence | refresh, app restart, DB restart, relogin: draft and submitted identical, ids unchanged | R (14 / 14) |
| fresh DB | runner 001 → 016 + seed (`db:reset`, 16 applied); FRESH suites 4 + 11 | I, WF04 suite |
| upgrade DB | 015 + WF05 data → 016 only, lossless, re-run no-op (27); 014 → 015 production shape (5); STOP + rollback (2 + 5) | I, WF04 suite |

## Related
- [WF05-PROD-05_functional-security-qa.md](WF05-PROD-05_functional-security-qa.md) · [WF05-PROD-05_evidence.md](WF05-PROD-05_evidence.md)
