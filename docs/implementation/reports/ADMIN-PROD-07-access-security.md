# ADMIN-PROD-07-access-security

**Evidence 3–11, 21–24: actors, OpsShell, verification, venture, delegation, DEC-ADM-D02 / D04, IDOR, escalation, concurrency, errors.** Parent: [ADMIN-PROD-07-qa-summary.md](ADMIN-PROD-07-qa-summary.md). HTTP / browser rows: `tests/visual/specs/admin-prod-07-qa.spec.ts` (new) on a freshly started server; DB rows: `src/lib/admin/*.db-test.ts`.

## 3. Actor × endpoint (reads, HTTP)
| Endpoint | admin | HUB / Ch / CLB leader | member | revoked-capability | anon |
|---|---|---|---|---|---|
| `GET /ops/verification-requests` | 200 | 200 / 200 / 200 | 403 | 403 | 401 |
| `GET /ops/venture-reviews` | 200 | 403 ×3 | 403 | 403 | 401 |
| `GET /ops/organizations/{CH_A}/access` (+ `/history`) | 200 | 200 / 200 / 403 | 403 | 403 | 401 |
| `GET /ops/feedback`, `/feedback/summary`, `/categories/DOMAIN`, `/account-requests` | 200 | 403 ×3 | 403 | 403 | 401 |

Mutations by Chapter / CLB leader, member, revoked user, anon — verification approve (CH_B), venture approve, grant on CH_B, feedback / category patch, lock, deactivate, process / decline deletion: every one 401 / 403 / 404, and every target row unchanged afterwards (asserted).

## 4. OpsShell routes and nav
| Route | admin | leaders | member / revoked | anon |
|---|---|---|---|---|
| `/ops/admin`, `/verification`, `/access` | 200 | 200 | 404 | → `/auth` |
| `/ops/admin/ventures`, `/feedback`, `/categories`, `/accounts` | 200 | 404 | 404 | → `/auth` |

Nav: admin 7 admin items; every leader exactly Home · Verification · Access. A capability-only `member:read` grantee (no admin capability, no `network:read`): `/ops/admin` and `/ops` 404. Every deep link is server-guarded (layout `requireOpsAdmin` + per-page capability).

## 5–9. Verification and venture
| Area | Result | Evidence |
|---|---|---|
| queue / detail / approve / reject / history / notification | PASS | `verification-queue.db-test`, `admin-prod-03-*`, `admin-prod-06-*` |
| one position = one request; CLB → Chapter → HUB Tổng fallback; never highest role | PASS | `admin-data.db-test` PD-1, routing tests |
| existing ACTIVE membership idempotent; no duplicate membership; self-approval 403 | PASS | `verification-queue.db-test` §7, self tests |
| IDOR: foreign / sibling / parent-child / revoked handler / forged org / direct API | 404 alike, nothing locked | queue scope + hardening tests, matrix above |
| venture DRAFT → PENDING → PUBLIC, REJECTED, resubmit, core edit on PUBLIC | PASS; old public stays live; candidate never public; swap only on approve | `venture-review.db-test` |
| fields: website http/https only, media-store logo, no tax code / registration | PASS | idem §website/logo |
| non-reviewer, foreign id, raw venture id, approve / reject race, edit vs approve, duplicate approve | 403 / 404 / one decision / 409 | idem, `admin-prod-04-api` |

## 10–12. Delegation (DEC-ADM-D02), HTTP
| Case | Status |
|---|---|
| grant HUB → CH_A, CH_A → CLB_A1, CLB_A1 → itself | 201 |
| grant upward, cross-branch, sibling, grandchild | 403 |
| grant `venture:review` / `access:delegate` / `account:escalate` | 422 |
| revoke: same-unit co-leader with `access:delegate` | 200 |
| revoke: parent → child, child → parent, sibling, parent grantor | 403 |
| revoke: no capability on unit, forged stored `access:delegate`, grantor after losing capability | 403 |
| revoke: forged path (actor's own unit, grant elsewhere) | 404 |
| revoke: PLATFORM_ADMIN | 200 |
| two revokes of one grant at once | 200 + 409 |
| revoked grantee, next request (API / page) | 403 / 404 immediately (no cache) |

Audit: each grant / revoke one `ACCESS_GRANTED` / `ACCESS_REVOKED`; refused calls none. UI: the parent unit sees grants but no Revoke control; the unit's own leader does.

## 18. DEC-ADM-D04
Leaders POST the old route (LOCK / DEACTIVATE / SOFT_DELETE) → 404 / 405; `/ops/admin/accounts` 404; no lock / deactivate CTA on the WF03 member page; `account_action_requests` stays empty; forged `account:escalate` row confers nothing (`account-ops.db-test`); PLATFORM_ADMIN direct LOCK through the UI works.

## 22–25. Escalation, concurrency, errors
| Area | Result |
|---|---|
| client scope spoof, forged capability, beyond-own grant, old `account:escalate`, historical grantor, direct API, deep link | all refused (rows above) |
| approve vs reject, duplicate approve, grant vs revoke, two revokes, feedback updates, process vs reject, duplicate lock | one terminal transition each (`*.db-test` concurrency + HTTP two-revoke) |
| 400 (`AUTH_EMAIL_INVALID`), 401, 403, 404, 409, 422 (bad field, bad limit, malformed JSON, missing decline reason) | `{ error: { code, message, request_id } }` only; no stack, no SQL; 0 × 5xx |

Note: two admin endpoints validate the body before the scope check (grant self-target `422`, decision without `version` `422`); the caller learns nothing about other units, and nothing changes. Classified as acceptable ordering, not a defect.

## Related
- [ADMIN-PROD-07-qa-summary.md](ADMIN-PROD-07-qa-summary.md) · [ADMIN-PROD-07-modules-ui.md](ADMIN-PROD-07-modules-ui.md) · [ADMIN-PROD-07-prod08-handoff.md](ADMIN-PROD-07-prod08-handoff.md)
