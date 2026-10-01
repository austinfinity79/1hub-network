# WF04-PROD-03_api-rbac-hardening

**WF04-PROD-03 — API / RBAC / validation / idempotency hardening.** 2026-10-02, branch `feat/wf04-prod-hardening` on `2a77a1e` (PROD-02). Canonical `/api/v1/programmes*` (API [05 §22](../../architecture/05_API_CONTRACT_P0_v1.0.md), amendment A5) on the PROD-02 persistence; decisions [DEC-W4P-D12](../../decisions/DECISION_LOG.md#dec-w4p-d12). No migration, table, role, UI or frontend change; the demo API and fixtures stay until PROD-04. Not pushed, not deployed.

## Result
| Gate | Result | Evidence |
|---|---|---|
| Impact map | PASS | matrix, idempotency list, audit union; new `src/lib/programme/*` and routes; WF01–WF03 only through session capabilities; WF05 through the shared form table |
| Programme read API | PASS | list (own orgs, 403 without `programme:read`), detail (same 404); canonical rows, no fixture |
| Programme write API | PASS | create, PATCH (allow-list), registration PUT; whole-list stages / problems |
| Org ownership | PASS | owner from the stored row; create owner must be in the actor's `programme:manage` scope; HUB / CHAPTER / CLB only |
| RBAC | PASS | `programme:read` / `programme:manage` = leader of exactly that org or platform admin; member, other-unit leader, onboarding-incomplete refused |
| Lifecycle | PASS | DRAFT → PUBLISHED → CLOSED only; repeats and reversals 409; edits DRAFT / PUBLISHED; ARCHIVED never written |
| Publish validation | PASS | contract §8 only: name, end ≥ start, all failing fields at once; no CHALLENGE / date / stage / form rule |
| Challenge | PASS | `metadata.challenge` on CHALLENGE only, typed list, no generic metadata write |
| Application reuse | PASS | form written to `programme_application_forms`; WF05 apply opens on publish, refuses after close; no application table or endpoint |
| Validation | PASS | 422 `PROFILE_VALIDATION_FAILED` with field reasons; malformed / unknown ids 404; undecodable `%` 400 from the router |
| Idempotency | PASS | `programme.create` / `publish` / `close`: replay, conflict on a different body; transitions 409 without a key |
| Audit | PASS | one event per state change: who, action, programme, organization, type, status / version / field names |
| Security | PASS | 401 / 403 / 404 matrix, header / query / body spoof, IDOR, leakage scan, 5xx = 0 |
| Targeted tests | PASS | rules 63, service 22, HTTP 8 |
| Protected regression | PASS | final build: visual / API 696/696, UAT 19/19, DB 505/505; 5xx 0, console errors 0 |

## Endpoints (added; nothing existing changed)
| Call | Capability | Result |
|---|---|---|
| `GET /programmes` | `programme:read` somewhere | list of own organizations' programmes |
| `POST /programmes` | `programme:manage` on body `organization_id` | 201 DRAFT |
| `GET /programmes/{id}` | `programme:read` on owner | detail |
| `PATCH /programmes/{id}` | `programme:manage` on owner | DRAFT / PUBLISHED |
| `PUT /programmes/{id}/registration` | `programme:manage` on owner | form, version bump; 409 once applications exist |
| `POST /programmes/{id}/publish` | `programme:manage` on owner | DRAFT → PUBLISHED |
| `POST /programmes/{id}/close` | `programme:manage` on owner | PUBLISHED → CLOSED |

Reused: session, `withApi` envelope, `authorize` / `organizationScope`, `runIdempotent`, `writeAudit`, WF05 `listOpenForms` / applications (read the form; unchanged).

## Actor matrix (enforced, tested)
| Actor | List | Detail | Create | Edit / registration / publish / close |
|---|---|---|---|---|
| Guest | 401 | 401 | 401 | 401 |
| Onboarding not done | 403 | 403 | 403 | 403 |
| Member (INDIVIDUAL_USER, HUB_MEMBER) | 403 | 404 | 403 | 404 |
| Leader, own org | own org only | ALLOW | own org; other org 403 | ALLOW |
| Leader, other org | its org only | 404 | 403 | 404 |
| Platform admin | all | ALLOW | any HUB / CHAPTER / CLB | ALLOW |

## Not implemented (by decision)
Archive (DEFERRED, D11); event writes (Q1); discarding a DRAFT (Q2); registration edits after applications, INDIVIDUAL, defaults for `required` / `step` (Q3); team rows (Q4); application counts (Q5); public list (D10). Owner and type immutability are enforced by the API (`immutable`), not by a trigger. The Idempotency-Key stays optional (I5): a create without a key is not de-duplicated, as on every other create.

## Independent review (read-only reviewer agent)
No Critical or High finding. Dispositions:

| # | Finding | Disposition |
|---|---|---|
| M1 | NUL / unpaired surrogate text and year-0 instants reached PostgreSQL → 500 | FIXED: `invalid` 422 in `rules.ts`; unit + HTTP tests |
| L5 | `2026-02-30T…` rolled over to March | FIXED: real calendar day, hour, minute, offset |
| L2 | items sent without an id got a random id, so a retried replacement bumped the form version | FIXED: id derived from position and content; repeat-safe (contract §14) |
| L1 | WF05 `loadForm` reads without a lock: an application created while a close commits can land on the just-closed programme | NOT FIXED here (WF05 code, out of scope); the application cannot be submitted (409); follow-up for WF05 |
| L3 | publish / close treat unparsable JSON as no body | ACCEPTED: same as `relationships/close` and event publish |
| L4 | linked events not filtered by organization or status | ACCEPTED: contract §10; links exist only in the seed (WF03 refuses `programme_id`) |
| L6 | constant organization types interpolated into SQL | ACCEPTED: a typed constant, no request data |
| L7 | an idempotent replay does not re-authorize within 24 h | ACCEPTED: shared store design (application.* identical) |
| Q | create under an ARCHIVED organization? | OPEN for the PO: A5 is silent, no rule invented |

The same M1 / L5 date gap exists in WF03 `events.ts` (pre-existing, not touched).

## Tests
| Gate | Result |
|---|---|
| format, lint, typecheck | PASS |
| unit | 35 files / 326 (rules 63 new; contract and idempotency catalogue updated) |
| build | PASS (`next build`, final tree) |
| DB (`pnpm test:db`) | 34 files / 505 (service 22 new; authz 10 capabilities; idempotency 13 operations) |
| HTTP API spec | `wf04-prod-api` 8/8 |
| protected visual / API (61 specs) | 696/696 on the final build: WF01 188, WF02 170, WF03 69, WF04 123 (demo 115 + API 8), WF05 38, L5 13, L6 4, auth / authz 21, shell 50, API contract 9, release 7, console 4 |
| UAT | 19/19 |
| mutation checks | removing the owner-scope check fails the IDOR test; removing the state check fails 3 lifecycle tests; file restored byte-identical |

## Related
- [WF04_PRODUCTION_CONTRACT.md](WF04_PRODUCTION_CONTRACT.md) · [WF04-PROD-02_db-persistence-hardening.md](WF04-PROD-02_db-persistence-hardening.md) · [../AUTHORIZATION_CAPABILITY_MATRIX_P0.md](../AUTHORIZATION_CAPABILITY_MATRIX_P0.md) · [../CLAUDE_LATEST_REPORT.md](../CLAUDE_LATEST_REPORT.md)
