# WF05-PROD-03_evidence

**WF05-PROD-03 — API / RBAC / lifecycle evidence.** Production build on :3972, local PostgreSQL at 016, deterministic WF05 fixture (`src/lib/application/testing.ts`). Main report: [WF05-PROD-03_api-rbac.md](WF05-PROD-03_api-rbac.md). HTTP = `wf05-prod-api.spec.ts`, service = `application-hardening.db-test.ts`.

## Direct API security matrix (HTTP, real sessions)
| Actor | Resource | Action | Expected = observed |
|---|---|---|---|
| owner | own venture / application | read venture, team, S02; PATCH venture; create, read, save, submit | 200 / 201 |
| ACTIVE EDIT member | owner's venture | read venture, team, S02; PATCH venture | 200 |
| ACTIVE EDIT member | team | invite, change a member | 403 |
| ACTIVE EDIT / VIEW member | owner's application | create for the venture | 403 `SCOPE_FORBIDDEN` |
| ACTIVE EDIT / VIEW member | owner's application | read, save, submit; `/me/applications` | 404; not listed |
| ACTIVE VIEW member | owner's venture | PATCH venture, team mutation | 403 |
| other user, second owner, programme operator | any of the above | every action | 404 |
| guest | every WF05 endpoint (9) | every action | 401, nothing written |

## IDOR and spoofing
Foreign venture in the body (both directions), another owner's draft / submitted id, spoofed `x-role` / `x-owner-profile-id` / `x-account-id` headers: 404, data unchanged (row compared). Body `owner_profile_id`, `status`, `created_by_account_id`, `primary_applicant_type`: 422 `not_accepted`. PATCH with `status`: 422.

## Lifecycle and programme state
| Case | Result |
|---|---|
| CLOSED programme: create / save / submit | 404 / 409 `NOT_ELIGIBLE` (`NOT_PUBLISHED`) / 409 |
| CLOSED draft read | 200, `editable: false`, `reason: NOT_PUBLISHED`, questions and saved answer present |
| CLOSED submitted read | 200 snapshot, `reason: SUBMITTED` |
| ARCHIVED programme (compatibility) | as CLOSED |
| DRAFT programme | create 404 |
| ARCHIVED venture: create / save / submit / read | 409 `ARCHIVED` / 409 `ARCHIVED` / 409 / `editable: false`, `reason: ARCHIVED` |
| SUBMITTED: save, resubmit | 409 `APPLICATION_SUBMITTED`; the DB guards (016) stay behind it |
| `/me/applications` | every own application, `programme.status` CLOSED / PUBLISHED |

## Form, version, duplicates
A registration change racing an application create waits on the share lock, then refuses with 409; form version stays 1 and the application references it. A duplicate pair: 409 `APPLICATION_EXISTS` with the existing `application_id`, one row, no constraint text. Applicant type: `TYPE_NOT_ACCEPTED` (existing suite), venture `type` invalid / immutable (WF02 suite).

## Idempotency (HTTP)
| Case | Result |
|---|---|
| create, same key + same body | 201, same id |
| create, same key + other body | 409 idempotency conflict |
| create, no key, existing pair | 409 `APPLICATION_EXISTS` |
| save, same body twice | same answers |
| submit, same key twice concurrently | 200 + 200, identical bodies, one audit |
| submit again without the key | 409 `APPLICATION_SUBMITTED` |
| expired key | new request (PROD-02 store) |

## Validation, error surface, concurrency
| Area | Result |
|---|---|
| unknown / duplicate / too many answers, non-string, > 2000 chars, extra key, malformed id, unknown programme | 422 with the field and reason, row unchanged; unknown programme 404 |
| malformed ids (`not-a-uuid`, 36 zeros, 36 dashes) on applications, ventures, team, S02 | 404, never 500 |
| malformed JSON body; array body | 422 |
| every refusal | frozen envelope keys only; no stack, SQL, constraint name or token |
| concurrent creates / submits without a key | [201, 409] / [200, 409]; one row, one SUBMITTED |
| save racing two submits | one SUBMITTED, one audit |
| 12 concurrent creates (pool of 10) | 12 / 12 (9 / 12 with the old second connection) |

## Audit
Create and submit: one row each with actor, `resource_id`, `programme_id`, `venture_id`, status and `request_id`, never answers; draft saves not audited (frozen contract).

## Restart / persistence recheck
`scripts/qa/wf05-restart-check.mjs` on the PROD-03 build: 14 / 14 (draft saved → app restart, DB restart, relogin → identical; submitted snapshot identical).

## Totals
| Suite | Result |
|---|---|
| unit | 33 / 307 |
| DB | 36 / 568 (new hardening suite 19) |
| WF05 API spec | 9 / 9 |
| protected regression (fresh `db:reset`) | 65 specs / 806 passed (16.3 min): WF01–WF05, L5, auth / authz, shell, API contract, release, the new WF05 API spec; 5xx, console, hydration 0. Run history: the first full run failed 3 tests that asserted the pre-A6 bare array (classified, updated); a second run was void — the host slept overnight (15 h, 83 test timeouts); the third, under `caffeinate`, passed |
| UAT | 19 / 19 |

## Related
- [WF05-PROD-03_api-rbac.md](WF05-PROD-03_api-rbac.md) · [WF05-PROD-02_evidence.md](WF05-PROD-02_evidence.md)
