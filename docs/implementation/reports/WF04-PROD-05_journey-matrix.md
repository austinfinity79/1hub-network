# WF04-PROD-05_journey-matrix

**WF04-PROD-05 — impact map and functional journey matrix.** 2026-10-02, branch `feat/wf04-prod-hardening` on `7ea892d`. Every journey runs on the real API and the local PostgreSQL; no fixture fallback exists (T00 static scan). Main report: [WF04-PROD-05_functional-security-qa.md](WF04-PROD-05_functional-security-qa.md).

## Impact map
| # | Area | Surface |
|---|---|---|
| A | WF04 routes | pages `/demo/programmes`, `/new`, `/[id]`, `/[id]/setup/{basic,journey,events,registration,team,review}` (Q6 keeps the path); API `GET/POST /programmes`, `GET/PATCH /programmes/{id}`, `PUT …/registration`, `POST …/publish`, `POST …/close` |
| B | Backend services | `lib/programme/{programme,rules,request,view,guard,types}`; shared `lib/api/{handler,envelope,errors,idempotency}`, `lib/idempotency/store`, `lib/audit/audit` |
| C | DB tables | writes: `programmes`, `programme_application_forms`, `audit_events`, `idempotency_keys`; reads: `organizations`, `role_assignments`, `applications`, `events`, `individual_profiles`, `user_accounts`; schema from migration 015 |
| D | Auth / RBAC | `lib/auth/{sessions,session-cookie}`, `lib/authz/{actor,authorize,matrix}` (`programme:read` / `programme:manage`), `lib/ops/{guard,scope,organizations}`, `lib/onboarding/state` |
| E | Application / Form | WF04 writes the canonical `programme_application_forms` row; WF05 owns `applications` (apply route `/programmes/{id}/apply`, project application pages); WF04 only counts applications to lock the form |
| F | Protected workflows touched | WF01 session (login, logout, expiry redirect); WF03 organizations (owner, ARCHIVED) and events (read only); WF05 application flow; OpsShell entry (P0 shell) |
| G | Regression suites | 63 specs: WF01 (14), WF02 (13), WF03 (10), WF04 (12 incl. `wf04-prod-qa`), WF05 (4), auth / authz session (2), shell / navigation / console health (3), API contract (1), release RC / internal alpha / L5 / L6 (4); unit; DB (migrations 001–015); UAT (19) |

## Functional journey matrix
| Journey | Actor | Preconditions | Action | Expected | Evidence |
|---|---|---|---|---|---|
| A. Programme list | Chapter 01 leader, admin, member, guest | seed rows | `GET /programmes`; open S01 | leader: own org only; admin: all; member 403; guest 401 / redirect | S01 (8), `read.db-test`, `wf04-prod-api` guest / member |
| B. Programme detail | leader, foreign leader | programme exists | `GET /programmes/{id}`; open S08 | 200 DTO with `actions`, `owner_archived`; foreign, unknown, malformed id → same 404 | S08, `wf04-prod-api` IDOR, QA-IDOR |
| C. Programme create | leader, admin, member | ACTIVE operational unit | `POST /programmes` (+ key); S02 "Lưu" | 201 DRAFT owned by the chosen managed unit; 1 `PROGRAMME_CREATED`; double click → 1 row; member 403 | S02, `wf04-prod-api`, QA-IDEM create |
| D. Programme edit | leader | not CLOSED, owner ACTIVE | `PATCH` basic / stages / problems | persisted; identical repeat writes and audits nothing; type / owner change 422 | S03, S08 basic, QA-IDEM edit |
| E. Programme publish | leader | DRAFT passing §8 checks | `POST …/publish`; S07 | PUBLISHED once; repeat 409; key replay 200; 1 `PROGRAMME_PUBLISHED` | S07, QA-IDEM publish, QA-AUDIT |
| F. Close (API / service) | leader | PUBLISHED | `POST …/close` | CLOSED once; DRAFT → CLOSED 409; repeat 409; concurrent `[200, 409]`, 1 audit; no close control on screen | QA-LIFE, S08, `programme.db-test` |
| G. Challenge data | leader, foreign leader | CHALLENGE | `PATCH problem_statements` | stored in `programmes.metadata.challenge` only; malformed 422, nothing stored; PROGRAMME refuses problems; foreign 404 | QA-CHAL, QA-IDOR, S03 Challenge, persistence DB test (9)(11) |
| H. Application / Form handoff | leader, venture owner | PUBLISHED, form TEAM / STARTUP | `PUT …/registration`; WF05 apply | form v1; application 201; key replay same id; duplicate 409 `APPLICATION_EXISTS`; form 409 once applied; after close 409 `APPLICATION_NOT_ELIGIBLE` | QA-APP, UAT-WF04, S05, WF05 suite |
| I. Refresh | leader | saved edit | reload | same persisted values | S03 "survive a refresh", S08 basic save |
| J. Direct route | 6 actors | — | open every WF04 URL, plain and with spoofed headers | leader / admin 200; member 404; guest → `/auth`; unbuilt routes 404 | T00 actor × route matrix, T00 404 |
| K. Relogin | leader | saved programme | logout → login; session expires mid-edit | 401 after logout, identical detail after login; save → `/auth?redirect=` same page | QA-PERS (2), restart check step 4 |
| L. Restart persistence | leader | PUBLISHED Challenge with stage, problem, form | restart app; restart DB container; fresh DB; upgrade to 015 | identical detail JSON; migrations 001–015 + seed from empty; 015 on 014 data keeps every row | `scripts/qa/wf04-restart-check.mjs` 10/10; persistence DB test (1)(2)(3)(12) |

## Idempotency per action
| Action | With the same key | Without a key |
|---|---|---|
| create | replays the 201, one row | a new DRAFT each time (I5, optional key) |
| edit (`PATCH`) / form (`PUT`) | — | identical body: 200, no write, no audit, form version stays |
| publish / close | replays 200, one transition, one audit | 409 `MEMBERSHIP_INVALID_TRANSITION` |
| concurrent close | — | one 200, one 409, one audit row |

## Related
- [WF04-PROD-05_functional-security-qa.md](WF04-PROD-05_functional-security-qa.md) · [WF04-PROD-05_test-inventory.csv](WF04-PROD-05_test-inventory.csv) · [WF04_PRODUCTION_CONTRACT.md](WF04_PRODUCTION_CONTRACT.md)
