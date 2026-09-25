# Claude Task Report

## 1. Task
- Task ID / name: M0-T05 — API client, error envelope and DTO conventions
- Scope requested: `/api/v1` foundation — frozen error envelope with its codes, success and list envelopes, request-id correlation, DTO conventions, a typed client written from the authoritative Markdown contract, and `GET /session`.
- Status: DONE
- Progress estimate: M0-T05 100%. M0 milestone 6 of 13 tasks complete. WF01 not started.

## 2. What was implemented
| File | Purpose |
|---|---|
| `src/lib/api/error-codes.ts` | 14 frozen codes, HTTP mapping, contract-gap codes |
| `src/lib/api/errors.ts` | `ApiError`, envelope builder, unexpected-error wrapping |
| `src/lib/api/envelope.ts` | List envelope, cursor/limit parsing |
| `src/lib/api/request-id.ts` | `X-Request-ID` resolution and generation |
| `src/lib/api/idempotency.ts` | Header parsing, the seven operation classes |
| `src/lib/api/handler.ts` | Route wrapper guaranteeing headers and envelope |
| `src/lib/api/client.ts` | Typed client, throws `ApiError` on any failure |
| `src/lib/api/types.ts` | Wire DTO types, hand-written from the contract |
| `src/app/api/v1/session/route.ts` | `GET /session` |

## 3. Contract source used
`docs/architecture/05_API_CONTRACT_P0_v1.0.md`, hand-transcribed. The sibling YAML was deliberately not used as the source and not generated from. It declares itself an implementation skeleton, names the Markdown authoritative, types `code` as a bare string with no enum, and defines fewer paths than the Markdown defines endpoints. A client generated from it would silently be unable to call most of WF02 and WF03. `contract.test.ts` records that evidence as assertions rather than leaving it as an opinion.

## 4. Conventions implemented
| Convention | Source | Implementation |
|---|---|---|
| Base path `/api/v1` | 05:14 | `API_BASE_PATH`, route lives under `app/api/v1` |
| DTOs, never ORM rows | 05:16 | `types.ts` declares wire shapes explicitly |
| ISO-8601 UTC timestamps | 05:22 | `IsoDateTime` |
| Opaque string IDs | 05:23 | `OpaqueId` |
| JSON content type | 05:29-36 | client sets `Accept` and conditional `Content-Type` |
| Request correlation | 05:38-46 | id on every response, client id honoured |
| Idempotency-Key | 05:48-63 | parsed and validated; seven operations named |
| List envelope | 05:69-79 | `listEnvelope`, default limit 50 |
| Single resource returned bare | 05:67 | no wrapper helper exists, on purpose |
| Error envelope | 05:83-94 | `ApiError.toEnvelope` |
| HTTP mapping | 05:98-107 | `HTTP_STATUS_MEANING`, drift-tested |

## 5. Frozen error codes
All 14, verified by exact set against the contract: `AUTH_RATE_LIMITED`, `AUTH_EMAIL_INVALID`, `AUTH_LINK_EXPIRED`, `AUTH_LINK_ALREADY_USED`, `AUTH_LINK_INVALID`, `AUTH_ACCOUNT_BLOCKED`, `PROFILE_VALIDATION_FAILED`, `VOCABULARY_ITEM_INACTIVE`, `PROFILE_DEACTIVATED`, `CONSENT_NOT_REVOCABLE`, `CONSENT_ALREADY_REVOKED`, `ONBOARDING_REQUIREMENTS_MISSING`, `MEMBERSHIP_INVALID_TRANSITION`, `SCOPE_FORBIDDEN`.

## 6. Contract gaps surfaced, not filled
1. **No error code for 401, 404 or 500.** The envelope requires a `code` and the HTTP table maps all three statuses, but the contract names no code for any of them. Rather than minting plausible-looking codes that would harden into an unapproved contract, three are namespaced `UNCONTRACTED_UNAUTHENTICATED`, `UNCONTRACTED_NOT_FOUND`, `UNCONTRACTED_INTERNAL`. They are obvious on the wire, greppable in logs, and a test asserts none appears in the contract or in the frozen set. **Needs a contract amendment.**
2. **No idempotency key store.** The contract requires the header on seven operation classes, but `001_p0_init.sql` has no table to record a key or replay a response. This implementation parses and validates the header and stops there rather than pretending to deduplicate. **Needs a schema decision**, already raised in the readiness report.

Neither gap blocks M0-T06.

## 7. GET /session
Returns `200 {"authenticated": false}`. The contract permits either 200 or 401 when unauthenticated and requires one consistent choice (05:149); this takes the contract's own recommendation, so app bootstrap needs no error path.

There is no session store and no database yet (M0-T06 and M0-T08), so the endpoint reports no identity rather than fabricating an account. A stub returning invented account data would be a fake success path. A Playwright test asserts the response carries no `account`, `profile` or `capabilities` key.

## 8. Validation results
All executed. `pnpm verify` exits 0; `pnpm visual` exits 0.

- Format: PASS
- Lint: PASS — 0 errors, 0 warnings
- Typecheck: PASS
- Unit tests: PASS — 61 passed / 61, 7 files (29 new for the API layer)
- Build: PASS — 31 routes including `/api/v1/session`
- Playwright: PASS — 64 passed / 64
- Live contract check: PASS — `{"authenticated":false}`, `x-request-id: req_...` present, client-supplied id echoed verbatim
- Route and gating regression: PASS — frozen routes 200, dev harnesses and `/login` 404

Disclosed: the first Playwright run had 63 passed and 1 failed, from my own test chaining `.json()` on the promise returned by `request.get()` instead of awaiting it. Fixed; runs after that pass 64 of 64.

## 9. Visual / Foundation QA
N/A for new work. This task adds no UI.

The existing visual suites ran as regression and passed: M0-T02 typography 7, M0-T03 shell and routes 33, M0-T04 primitives 17. Baselines were neither regenerated nor touched. `design-reference/final/**` remains untouched.

## 10. SOT compliance
- Business SOT: not exercised. No workflow endpoint implemented.
- Data SOT: not exercised. No schema, no persistence.
- Design SOT: not exercised. No UI.
- API Contract: implemented as frozen, with the two gaps in section 6 reported rather than resolved. No endpoint, code, status or convention was invented.
- Deviations: none. The `UNCONTRACTED_` codes are a declared gap marker, not an invented contract; they exist because the envelope cannot omit a required field.

## 11. Regression impact
- Checked: M0-T01 bootstrap smoke, M0-T02 typography and fonts, M0-T03 shell and all 25 frozen routes, M0-T04 primitives, dev-route gating, full code gate chain.
- Result: PASS on all. `/` serves its bootstrap markup; frozen routes 200; dev harnesses and `/login` 404.
- Regression found: None.

## 12. Git
- Branch: `main`
- Commit hash: `a9f36655a9413cbd34657af97ed0895c325cc9bf`
- Commit message: `feat(m0-t05): API client, error envelope and DTO conventions`
- Working tree status: clean.

## 13. Recommended next task
M0-T06 — database and migration foundation. Add a `docker compose` PostgreSQL service on a dedicated port, a migration runner that applies `db/migrations/001_p0_init.sql` unchanged, and `db:migrate` / `db:reset` scripts. Introspect the applied schema into the ORM layer rather than authoring a parallel schema, so the frozen SQL stays the single source. Exit criterion: a fresh database reports all 27 tables, the runner is idempotent, and the visual suite still passes as regression.

Note for that task: the readiness report found the migration cannot store several frozen lifecycle states, including event `LIVE`/`ENDED`/`CANCELLED`, membership `SUSPENDED`/`ALUMNI`/`WITHDRAWN`, and profile `DEACTIVATED` where the schema has `INACTIVE`. M0-T06 should apply `001` unchanged and record those gaps; fixing them belongs to an additive `002` once the contract-versus-schema conflicts are ruled on.
