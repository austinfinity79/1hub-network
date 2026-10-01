# WF04-PROD-04_frontend-api

**WF04-PROD-04 — frontend fixture → real API.** 2026-10-02, branch `feat/wf04-prod-hardening` on `e0dc779` (PROD-03). The approved WF04 screens read and write the canonical `/api/v1/programmes*`; the server stays the source of truth. PO decisions 1–7 recorded as [DEC-W4P-D13](../../decisions/DECISION_LOG.md#dec-w4p-d13). No migration, endpoint, role, table, Event write or redesign. Not pushed, not deployed.

## Result
| Gate | Result | Evidence |
|---|---|---|
| Impact map | PASS | WF04 pages, `components/programme-demo/*`, `lib/programme/*`; shared `DemoPage` frame (notice optional, WF05 unchanged), matrix untouched |
| Runtime fixture removal | PASS | 0 runtime imports of fixtures / session store / demo read model (T00 static scan); demo API, guard, store, read model removed |
| Programme list | PASS | `GET /programmes`; scope; loading / empty / error + retry; refresh |
| Programme detail | PASS | server-rendered from the service; same 404 (real HTTP 404) |
| Create/edit | PASS | `POST` (Idempotency-Key, double click → 1 row), `PATCH` stages / problems / basic, persisted and re-read |
| Publish | PASS | `POST …/publish`; checklist = contract §8 only; double click → 1 publish; conflict re-read |
| Close | PASS | S08 close + inline confirmation → CLOSED, audited once, read only after |
| Archived org behavior | PASS | server 409 on every write and create; no enabled write flow; still readable |
| Challenge | PASS | `metadata.challenge` through PATCH; no second store; PROGRAMME has none |
| Application/Form | PASS | canonical form via `PUT …/registration`; TEAM / STARTUP only; locked once an application exists; WF05 apply handoff and close → 404 |
| Event boundary | PASS | S04 read only; 0 Event writes |
| Loading/error/empty | PASS | list states; save error + retry; 422; 409; 404; disabled / read only |
| Responsive | PASS | 1440 / 768 / 390 on S01–S08 without overflow; typography |
| Targeted tests | PASS | WF04 specs 60/60; unit and DB below |
| Protected regression | PASS | final build: 62 specs / 637, UAT 19/19, DB 509, unit 307; 5xx 0, console / hydration errors 0 |

## Backend touch (existing endpoints only)
| Change | Why |
|---|---|
| detail adds `actions {edit, registration, publish, close}` and `owner_archived` | screens never re-derive rules (API 05 §16 item 8) |
| create / writes refuse an ARCHIVED owner (409); `programmeOwnerOptions` excludes it | PO decision 1 |

## Fixture / runtime removed
`src/app/api/v1/demo/programmes/**`, `lib/programme-demo/{guard,read-model,session-store,readiness}.ts`, `components/programme-demo/demo-store.tsx`. Kept for tests: `fixtures.ts`. Tests of removed modules deleted with them (session store 10, demo checklist 9); `read-model.db-test` rewritten to `lib/programme/read.db-test.ts`; the demo H5 checks in three unit tests rewritten to the §8 checklist.

## Deliberately still deferred
| UI action | Reason |
|---|---|
| add a registration question | a new question needs `required` and `step`; no approved default (Q3(b)) |
| event add / edit / remove (S04) | PO decision 2 |
| team rows (S06), application counts | Q4, Q5 |
| production routes and the "Demo · Internal Alpha" OpsShell group label | Q6 (routes stay `/demo/programmes/*`) |
| "(demo)" in the seed / production programme name | data, Q8 |
| pixel reference method | Q9 (PROD-06); ADM5 primitives still compared on S01 / S02 |

## Tests
| Gate | Result |
|---|---|
| format, lint, typecheck | PASS |
| unit | 33 files / 307 (−19 with the removed demo modules; 3 H5 checks rewritten) |
| build | PASS (`next build`, final tree) |
| DB (`pnpm test:db`) | 34 files / 509 (service 26: +4 actions / archived owner; read path 9, rewritten) |
| WF04 specs (11) | 60/60: T00 5, S01 8, S02 8, S03 8, S04 3, S05 5, S06 2, S07 7, S08 5, UAT 1, API 8 (replace the 115 demo-behaviour tests) |
| cross-workflow specs updated | REL-SEC (`/api/v1/programmes` instead of the demo API), P0-SHELL (seed Challenge), WF05-S01 (operator DRAFT is a row now) |
| protected regression (62 specs) | 637/637: WF01 188, WF02 170, WF03 69, WF04 60, WF05 38, L5 13, L6 4, auth / authz 21, shell 50, responsive 4, API contract 9, release 7, console 4 |
| UAT | 19/19 |
| fixed during the task | an `[id]/loading.tsx` made unknown ids a soft 404 (status 200); removed, ids are real 404 again |

## Related
- [WF04_PRODUCTION_CONTRACT.md](WF04_PRODUCTION_CONTRACT.md) · [WF04-PROD-03_api-rbac-hardening.md](WF04-PROD-03_api-rbac-hardening.md) · [../CLAUDE_LATEST_REPORT.md](../CLAUDE_LATEST_REPORT.md)
