# ADMIN-PROD-01-data-api-handoff

**Canonical data map, DB impact, future Admin API, feedback, categories, content / registry boundaries, audit and notifications** (evidence 12, 13, 15 – 17, 21, 22, 25 – 27). Parent: [ADMIN-PROD-01-runtime-contract.md](ADMIN-PROD-01-runtime-contract.md). Nothing here is implemented.

> **Superseded in part (ADMIN-PROD-07-CONTRACT-FIX):** revoke authority is now exact-unit only ([DEC-ADM-D02](../../decisions/DECISION_LOG.md#dec-adm-d02)); `account:escalate` and the leader account-request route are withdrawn ([DEC-ADM-D04](../../decisions/DECISION_LOG.md#dec-adm-d04)). Historical evidence below is kept as recorded.

## Canonical data map (evidence 25)
| Module | Canonical source (one copy only) |
|---|---|
| RoleVerificationRequest | new `role_verification_requests` (shared with Sprint1 S1-UAT-03B, one table); effects in `leadership_records`, `community_memberships` |
| Profile | `individual_profiles` (+ `location_text`); admins read, never edit another profile (CAP D3) |
| Organization | `organizations`, `organization_relationships` |
| Roles / delegation | `role_assignments` (+ `capability`) |
| Venture | `projects` (+ `website`, `logo_asset_id`) = the approved public version; new `venture_reviews` holds pending submissions |
| Feedback | `feedback_submissions` (extended) |
| Category | `vocabulary_items` |
| Account / user | `user_accounts`, `account_deletion_requests` (extended), new `account_action_requests` |
| Notifications | new `notifications` (two producers only) |
| Audit | `audit_events` |

## DB impact (evidence 27) — no migration in this task
| Capability | Class | Justification |
|---|---|---|
| role verification | NEW_TABLE `role_verification_requests` (requester, position, level, organization, period, routed_to_org, status PENDING / APPROVED / REJECTED / WITHDRAWN, handler, handled_at, reject_reason, timestamps) | one open membership per (profile, org) (`uq_open_membership`) cannot hold several positions or past terms; the request has its own lifecycle |
| verification effects | REUSE_EXISTING `leadership_records`, `community_memberships` | — |
| venture review | NEW_TABLE `venture_reviews` (venture, kind FIRST_PUBLISH / CORE_CHANGE, proposed core values, version, status PENDING / APPROVED / REJECTED / WITHDRAWN, submitted / reviewed by and at, reject_reason) | PD-2: unapproved edits must live apart from the live public row; no enum change to `project_status` |
| venture fields | COLUMN_CHANGE `projects.website`, `projects.logo_asset_id` (media asset store) | PD-3 |
| organizations | NO_CHANGE (`publication_status` DRAFT / PUBLISHED / ARCHIVED) | — |
| delegation | COLUMN_CHANGE `role_assignments.capability` (nullable) | PD-6 via the existing grant record |
| location | COLUMN_CHANGE `individual_profiles.location_text`; data: COUNTRY items (catalog + OTHER), REGION items (VN provinces; others optional, `metadata.country`) | PD-4 |
| feedback | COLUMN_CHANGE `feedback_submissions` (type, context, screenshot_asset_id, guest_email, priority, assigned_owner, resolution_note, updated_at); status enum NEW / IN_REVIEW / DONE (enum unused today) | PD-5, §12 |
| categories | NO_CHANGE | — |
| account lifecycle | COLUMN_CHANGE `account_deletion_requests` (status, handled_by, handled_at); NEW_TABLE `account_action_requests` (requester, target account, action LOCK / DEACTIVATE / SOFT_DELETE, reason, status, handler) | PD-7: leader escalations have no home |
| notifications | NEW_TABLE `notifications` (recipient, type, resource, created_at, read_at) | §22 in-system notices need read state |
| queues / audit queries | INDEX only with query-plan evidence | — |

## Admin API handoff (evidence 26)
| Endpoint | Class |
|---|---|
| `GET /ops/verification-requests` (scope-filtered) · `GET …/{id}` · `POST …/{id}/approve` · `POST …/{id}/reject` (reason?) | NEW |
| user side `POST /me/verification-requests`, `PATCH …/{id}`, `POST …/{id}/withdraw`, `POST …/{id}/resubmit` | NEW (Sprint1 S1-UAT-03B, same contract) |
| `GET /ops/organizations`, dashboard, members, profile, relationships | REUSE |
| `POST /ops/organizations` (DRAFT) · `POST …/{id}/activate` · `POST …/{id}/deactivate` | NEW |
| `GET /ops/organizations/{id}/access` · `POST …/access` (role or capability grant) · `POST …/access/{grantId}/revoke` | NEW |
| `GET /ops/venture-reviews` · `GET …/{id}` (public vs proposed) · `POST …/{id}/approve` · `POST …/{id}/reject` (version, reason?) | NEW |
| `POST /ventures/{id}/publish` → submits a review; `PATCH /ventures/{id}` → core fields of a PUBLIC venture go to the pending review; `website`, `logo`; `GET /ventures/{id}` shows public + pending | HARDEN |
| `POST /feedback` | NEW (Sprint1 S1-UAT-02) |
| `GET /ops/feedback` (A05 placeholder) · `GET …/{id}` · `PATCH …/{id}` (type, priority, owner, status, note) · `GET /ops/feedback/summary?week=` | NEW |
| `GET /vocabularies/{type}` | REUSE |
| `GET /ops/categories/{type}` · `POST …/{type}` · `PATCH …/{type}/{id}` | NEW |
| `POST /ops/organizations/{id}/members/{profileId}/account-requests` · `GET /ops/account-requests` · `POST /ops/account-requests/{id}/{process,decline}` · `POST /ops/accounts/{id}/{lock,unlock,deactivate,reactivate}` | NEW |
| `GET /me/notifications` · `POST /me/notifications/read` · `GET /ops/summary` (Admin Home counts) | NEW |
| `GET /session` (new capabilities in `capabilities`) | HARDEN |
Errors: existing codes only (422 `PROFILE_VALIDATION_FAILED`, 403 `SCOPE_FORBIDDEN`, 404, 409 `MEMBERSHIP_INVALID_TRANSITION` for stale or illegal transitions); a new code only with a contract amendment.

## Feedback (evidence 12, 13) — PD-5
Lifecycle NEW → IN_REVIEW → DONE, and NEW → DONE (duplicate / spam, with a note); no REOPENED. Fields: type (BUG, UX, FEATURE, OTHER; the user picks one of the first three, admins may reclassify), content (≤ 2,000), screenshot (≤ 5 MB, optional), guest_email (optional, may be used to reply), account / profile when signed in, route / screen and browser / device context, created_at, assigned owner, priority (LOW / MEDIUM / HIGH), status, resolution note. Screenshots are deleted 90 days after submission (daily job); the record stays per its lifecycle. **Weekly summary** (in the portal, no e-mail / Slack): for an ISO week, counts by type (technical bug, UX, feature request, other) × status (open = NEW + IN_REVIEW, closed = DONE), by priority and by owner.

## Categories, content, registry (evidence 15 – 17)
| Item | Contract |
|---|---|
| categories | existing types only; COUNTRY, REGION, DOMAIN, SKILL, SPECIALIZATION: create item (slug fixed), label, order, ACTIVE / ARCHIVED (never delete); VENTURE_STAGE: label and order only (codes are product logic); no new type |
| Homepage | STATIC_DEPLOYED_CONTENT (PO-set order, DL:1380) |
| About HUB | STATIC_DEPLOYED_CONTENT (PO supplies content) |
| featured activities | CANONICAL_LINKED_CONTENT target (events / programmes / projects); OUT_OF_P0 for now: public programme pages are out (WF06 D3) and no editing need is evidenced |
| legal / static | STATIC_DEPLOYED_CONTENT (new version = PO decision + migration, DL:1368) |
| action / navigation registry | keep the typed code registry (`Cta` href / inert, `FROZEN_ROUTES`, nav files) and the no-dead-control specs; no runtime registry in P0 |

## Audit and notifications (evidence 21, 22)
Every admin mutation writes `audit_events` in its transaction: actor, target (type, id), action, scope (organization id in `after_data` when scoped), time, before / after status, optional reason. Never: passwords, tokens, session values, profile fields, feedback text, screenshots, uploaded documents. New codes: `VERIFICATION_REQUEST_*`, `VENTURE_REVIEW_*`, `ORGANIZATION_CREATED` / `_ACTIVATED` / `_DEACTIVATED`, `ACCESS_GRANTED` / `_REVOKED`, `FEEDBACK_UPDATED`, `VOCABULARY_ITEM_*`, `ACCOUNT_LOCKED` / `_UNLOCKED` / `_DEACTIVATED` / `_REACTIVATED`, `ACCOUNT_REQUEST_*`. Notifications: verification approve / reject and venture approve / reject → a `notifications` row for the requester / owner; a verification submission shows in the receiving handlers' queue count (no per-handler row); feedback: weekly summary only. No e-mail, push or notification centre.

## Related
- [ADMIN-PROD-01-rbac-matrix.md](ADMIN-PROD-01-rbac-matrix.md) · [ADMIN-PROD-01-implementation-plan.md](ADMIN-PROD-01-implementation-plan.md) · [05_API_CONTRACT_P0_v1.0.md](../../architecture/05_API_CONTRACT_P0_v1.0.md)
