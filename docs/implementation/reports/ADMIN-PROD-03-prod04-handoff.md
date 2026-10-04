# ADMIN-PROD-03-prod04-handoff

**Evidence 21: exact handoff to ADMIN-PROD-04 (venture review + organization delegation APIs).** Parent: [ADMIN-PROD-03-qa.md](ADMIN-PROD-03-qa.md). ADMIN-PROD-04 is not started.

## Venture review — ready
| Piece | Where |
|---|---|
| store | `venture_reviews` (kind FIRST_PUBLISH / CORE_CHANGE, `proposed` snapshot v1, `version`, status PENDING / APPROVED / REJECTED / WITHDRAWN, submitter, reviewer, reason ≤ 500; one PENDING per venture); `projects.website` / `logo_asset_id` (017) |
| domain | `src/lib/admin/venture-review.ts`: `VENTURE_CORE_FIELDS`, `normalizeCore`, `changedCoreFields`, `reviewRequired`, `ventureReviewState`, `coreSnapshot` / `parseCoreSnapshot`, `parseWebsite`, `isLogoReference`, `loadVentureCore`, `VENTURE_REVIEW_TRANSITIONS` |
| authority | `venture:review`, platform-only (`holdsPlatform`) |
| audit / notice | `VENTURE_REVIEW_*` codes typed; `notify` + `decisionNotification('VENTURE_REVIEW', status)` |
| pattern to copy | ADMIN-PROD-03 `decidable()`: row `FOR UPDATE`, PENDING + `version` (409), grant re-read `FOR SHARE`, no self-decision (an admin who owns or co-owns the venture cannot review it; audited), one transaction for status + effects + audit + notice; optional idempotent operation (new, e.g. `venture.review`, contract amendment) |

## Venture review — to build
| Endpoint (ADMIN-PROD-01 data / API handoff) | Note |
|---|---|
| `GET /ops/venture-reviews`, `GET …/{id}` | platform list / detail; detail shows live vs proposed with `changedCoreFields` |
| `POST …/{id}/approve` · `…/reject` `{ version, reason? }` | approve applies `proposed` to `projects` + replaces `project_domains` in one transaction; FIRST_PUBLISH also sets ACTIVE / PUBLIC; reject keeps the live version |
| `POST /ventures/{id}/publish` (HARDEN) | files a FIRST_PUBLISH review instead of self-publishing (DEC-PDF-D1 superseded) |
| `PATCH /ventures/{id}` (HARDEN) | on a PUBLIC venture, core fields (`reviewRequired`) go to the pending review (create or update it, `version + 1`); non-core fields write through; `website`, `logo` join the write model |
| `GET /ventures/{id}` (HARDEN) | owner sees live + pending; no public path ever reads `venture_reviews` (test-enforced) |
Coordinate with S1-UAT-06 (owner flows): one table, no fork.

## Organization delegation — ready
`grantAccess` / `revokeAccess` (`src/lib/admin/delegation.ts`): reach, ceiling, no self-grant, archived source / target, grant re-read `FOR SHARE`, `ACCESS_GRANTED` / `_REVOKED`; `delegationReach`, `delegationSourceFor`, `holdsRoleAt`. Endpoints to add: `GET /ops/organizations/{id}/access` (needs a list reader: live grants of the unit with role / capability, grantee discovery name, grantor, dates), `POST …/access` `{ grantee_profile_id, capability? }`, `POST …/access/{grantId}/revoke`. Organization lifecycle (`org:lifecycle`): `POST /ops/organizations` (DRAFT), `…/activate`, `…/deactivate` (ARCHIVED, read-only); codes `ORGANIZATION_CREATED` / `_ACTIVATED` / `_DEACTIVATED`.

## Operational rule that becomes live with the access API
The release before 017 reads a capability-only grant as the whole role: before any application rollback below 017, close them (statement in the 017 header).

## Carried open items
| Item | Owner |
|---|---|
| ops entry for capability-only grantees (`/ops` needs `network:read`, not delegable) | ADMIN-PROD-06 |
| escalation target must be a member of the filing unit | ADMIN-PROD-05 |
| feedback `RECEIVED` response label (schema gap D3) | `POST /feedback` task |
| legacy conversion run + onboarding cut-over | S1-UAT-03B |

## Related
- [ADMIN-PROD-03-qa.md](ADMIN-PROD-03-qa.md) · [ADMIN-PROD-02-data-foundation.md](ADMIN-PROD-02-data-foundation.md) · [ADMIN-PROD-01-data-api-handoff.md](ADMIN-PROD-01-data-api-handoff.md)
