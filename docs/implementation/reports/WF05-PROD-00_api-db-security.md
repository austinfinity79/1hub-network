# WF05-PROD-00_api-db-security

**WF05-PROD-00 — API matrix, DB / migration gaps, security and privacy, tests, visual risk.** Read-only audit (catalog SELECTs, GET probes). Gap IDs refer to the [gap matrix](WF05-PROD-00_gap-matrix.md).

## API matrix
Every route resolves the actor from the session cookie; none reads owner, role or status from the request.
| Route | Method | Auth | RBAC | Persistence | Validation | Idempotency | Audit | Status |
|---|---|---|---|---|---|---|---|---|
| `/applications` | POST | 401 | owner; member 403; other 404 | INSERT … ON CONFLICT (partial unique) | unknown keys 422, strict UUID, status not accepted | `application.create` | `APPLICATION_DRAFT_CREATED` (no answers) | GREEN |
| `/applications/{id}` | GET | 401 | owner; others / malformed 404 | — | strict UUID | — | — | GREEN |
| `/applications/{id}` | PATCH | 401 | owner, row lock | per-question merge | unknown keys / questions / > 2000 chars 422 | none (idempotent by value) | none (contract: 2 events only) | PARTIAL (G09, G11) |
| `/applications/{id}/submit` | POST | 401 | owner, row lock, eligibility again | SUBMITTED + snapshot, one transaction | missing required → 422 | `application.submit` | `APPLICATION_SUBMITTED` | GREEN |
| `/me/applications` | GET | 401 | session profile | — | — | — | — | PARTIAL (bare array, G07) |
| `/ventures` | POST | 401 | onboarding done | yes | unknown, type, owner, status refused | `venture.create` | yes | GREEN |
| `/ventures/{id}` | GET / PATCH | 401 | read owner or ACTIVE member; edit owner or EDIT | yes | yes | — | `UPDATED` | PARTIAL (500, G06) |
| `/ventures/{id}/publish` | POST | 401 | owner | yes | five fields | repeat returns state | `PUBLISHED` | PARTIAL (G06) |
| `/ventures/{id}/team`, `…/{membershipId}` | GET / PATCH / DELETE | 401 | owner; membership must belong to the venture | soft REMOVED | yes | — | yes | GREEN |
| `…/team/invitations` | POST | 401 | owner | yes | yes | missing (G08) | yes | PARTIAL |
| `…/invitations/{id}/accept`, `decline` | POST | 401 | invitee e-mail match | yes | — | — | yes | GREEN |
| `/me/ventures`, `/me/venture-invitations` | GET | 401 | session | — | — | — | — | GREEN |
| `/demo/projects`, `/demo/projects/{id}` | GET | 401 / 403 | WF02 read rules | — | — | — | — | DEMO_ONLY namespace on real data (G22); `{id}` shares G06 |
Probes: guest 401 everywhere; leader / ops on another owner's DRAFT or SUBMITTED application 404; `not-a-uuid`, nil UUID 404; 36-character non-UUID venture id **500** (G06); bad `%` encoding / unsupported method → framework 400 / 405 outside the envelope (G14).

## DB / migration gaps (proposals; no migration written)
| # | Item | Why required | Current failure mode | Existing model enough? | Migration |
|---|---|---|---|---|---|
| D1 | BEFORE DELETE guard on SUBMITTED applications | submitted record must be immutable | 013 trigger covers UPDATE only; a DELETE drops it without audit | no | YES (G16) |
| D2 | immutable `venture_id`, `programme_id`, `primary_applicant_type`, `created_by` on DRAFT | integrity | only the service refuses | partly | optional (G17) |
| D3 | venture type frozen while applications exist | applicant type must match | only the service refuses; 0 mismatches today | partly | optional (G17) |
| D4 | lock the form row at create (`FOR SHARE`) | Q3 form lock | race with `PUT …/registration` | yes, service change | NO (G10) |
| D5 | PUBLISHED programme at insert / submit | defence in depth | service only | yes | optional |
| D6 | indexes on `created_by` / `submitted_by`; full `venture_id` index if WITHDRAWN arrives | account deletion, new status | partial index covers today's two states | yes for now | later |
| D7 | `CHECK (jsonb_typeof(snapshot) = 'object')` | shape integrity | no shape check | — | optional (G17) |
| D8 | one active application per pair | — | exists: `uq_applications_active_pair` | yes | NO |
| D9 | application role not table owner | trigger cannot be disabled | local role owns tables | — | infra / GRANT (G18) |

## Security / privacy
| Finding | Severity | Gap |
|---|---|---|
| application answers and team names persist in `idempotency_keys.response_body` (create 5 rows, submit 4 rows locally), never purged — a second copy of private answers | medium | G15 |
| malformed venture id → 500, and 500s are not logged | medium | G06, G12 |
| pool exhaustion near 10 concurrent writes (second connection inside transactions); invite e-mail inside a row-locked transaction | medium (robustness) | G13 |
| no rate limit; CSRF SameSite=lax only | low | G14 |
| snapshot holds team display names; a future operator review needs a consent rule | low, future | G33 |
| clean: no answers in audit (`after ? 'answers'` false), no uploads, generic error messages, random UUIDs, no sensitive logging, no cross-user read | — | — |

## Tests
| Area | Unit | DB | HTTP / e2e |
|---|---:|---:|---:|
| Application | 0 | 13 | L5 10 + WF05 UAT 10 (API, spoofing, create idempotency) |
| Venture / team / invitations | 0 | 24 / 28 / 12 | WF02 S05 16, S06 9, S08 12, UAT 16 |
| Demo read model | 0 | 6 | WF05 S01 13, S02 13, T00 2 |
| WF04 → WF05 handoff | — | 2 (in `programme.db-test`) | WF04 UAT 1 |
Missing (G34): EDIT member on applications; submit / GET draft / GET submitted after CLOSED; concurrent submit without a key; create vs `PUT registration` race; malformed venture id; invite idempotency; PATCH on an ARCHIVED venture; DELETE of SUBMITTED; HTTP replay of submit with a key; restart / relogin persistence; concurrency load; a WF05 API / security spec.

## Visual impact of hardening
| Surface | Risk | Reason |
|---|---|---|
| S01 / S02 | MEDIUM | removing the notice / reset shifts layout; no approved reference (G35) |
| shell entry "Dự án & Startup · Demo" | HIGH if relabelled | rendered on every protected WF02 screen; href-only change LOW |
| L5 SUB0–SUB3, CHOOSE | LOW | runtime already real; fixes are text / state; adding navigation would be HIGH |
| WF02 `/projects` showing application status | HIGH | protected, approved ME7 |
| API rename, actor-key removal, redirects | NO_VISUAL_IMPACT | — |
SHELL-MOBILE-01: S01 / S02 sit in MemberShell with their own responsive opt-in; L5 screens use no shell. WF05 adds nothing beyond baseline; the unmerged `fix/member-shell-mobile` lane edits the same layout (G36).

## Related
- [WF05-PROD-00_gap-audit.md](WF05-PROD-00_gap-audit.md) · [WF05-PROD-00_gap-matrix.md](WF05-PROD-00_gap-matrix.md) · [WF05-PROD-00_runtime-matrices.md](WF05-PROD-00_runtime-matrices.md)
