# ADMIN-PROD-02-data-foundation

**Evidence 7 – 15: role verification, venture review, core-field detection, website / logo, feedback, account actions, categories, notifications, audit.** Parent: [ADMIN-PROD-02-rbac-scope-foundation.md](ADMIN-PROD-02-rbac-scope-foundation.md). Code in `src/lib/admin/`; schema in migration 017 ([DB / migration](ADMIN-PROD-02-db-migration.md)).

> **Superseded in part (ADMIN-PROD-07-CONTRACT-FIX):** revoke authority is now exact-unit only ([DEC-ADM-D02](../../decisions/DECISION_LOG.md#dec-adm-d02)); `account:escalate` and the leader account-request route are withdrawn ([DEC-ADM-D04](../../decisions/DECISION_LOG.md#dec-adm-d04)). Historical evidence below is kept as recorded.

## 7. RoleVerification foundation (`verification.ts`, PD-1)
| Item | Foundation |
|---|---|
| store | `role_verification_requests`, the one table for Sprint1 S1-UAT-03B (user side) and ADMIN-PROD-03 (queue) |
| fields | requester `requester_profile_id` · position `position_title` (≤ 200, the onboarding claim bound) · organization `organization_id` (its type is the level) · period `period_from` / `period_to` (month precision; no end = current term) · receiving unit `routed_to_org_id` · `submitted_at` · handler `handled_by_account_id` · `handled_at` · `reject_reason` (≤ 500, REJECTED only) · `version` (stale decisions → 409) · history = audit events |
| states | PENDING → APPROVED / REJECTED (handler) · PENDING → WITHDRAWN (requester) · REJECTED → PENDING (resubmit); APPROVED, WITHDRAWN final (`VERIFICATION_TRANSITIONS`); UAT labels Chờ xác minh / Đã xác minh / Không được xác minh |
| one per position | `uq_rvr_declared_position` (requester, unit, lower(title), start month) while not WITHDRAWN; the writer answers 422 `duplicate` |
| writer | `fileVerificationRequest(exec, …)`: parses (YYYY-MM, past or current, Vietnam time), unit must be a PUBLISHED HUB / CHAPTER / CLB, routes with `nearestResponsibleUnit` skipping the requester as a handler, records the unit, audits `VERIFICATION_REQUEST_SUBMITTED` (ids, status, fallback flag; never the title) |
| predicates | `canHandleVerification` (never the requester, PLATFORM_ADMIN included: self-selection never confirms itself), `verificationQueueScope`, `approvalEffect` (current term → leadership ACTIVE + membership; ended → ALUMNI only; never a RoleAssignment) |
| not here | queue / decision API, withdraw / edit / resubmit endpoints, onboarding cut-over (ADMIN-PROD-03, S1-UAT-03B) |

## 8. Venture review foundation (`venture-review.ts`, PD-2)
Smallest persistence: `projects` stays the approved public version; a submission waits in `venture_reviews.proposed` (core snapshot, schema_version 1) with `kind` FIRST_PUBLISH / CORE_CHANGE, `version`, `status` PENDING / APPROVED / REJECTED / WITHDRAWN, submitter, reviewer, `reject_reason`. One PENDING row per venture (`uq_venture_reviews_pending`); a rejected venture is resubmitted as a new row (history = rows + audit). User-facing state is derived (`ventureReviewState`): DRAFT, PENDING_REVIEW, PUBLIC (with `pendingChange`), REJECTED, ARCHIVED. No public path reads `venture_reviews` (test-enforced). No versioning engine.

## 9. Core-field change detection
Frozen set `VENTURE_CORE_FIELDS`: name, summary (one-line description), domain_ids (sector), stage_id, region_id, website, logo_asset_id, owner_role_label. Team membership is not core (contract). `changedCoreFields` compares normalized values (trimmed text, lower-cased ids, de-duplicated sorted domains); `reviewRequired` → YES exactly when a PUBLIC venture changes a core field; a DRAFT edit is private and reviewed at first publish; type, team or presentation changes never trigger one.

## 10. Website / logo storage (PD-3)
`projects.website` (http / https, ≤ 500, the existing `safeUrl` rule; `parseWebsite`) and `projects.logo_asset_id` (`asset_<32 hex>` in the existing media asset store, as avatars; `isLogoReference`). Both checked in PostgreSQL. No business registration / tax code column.

## 11. Feedback foundation (`feedback.ts`, PD-5, FB-01)
`feedback_submissions` extended (one table with Sprint1 FB-01): `type` BUG / UX / FEATURE (+ OTHER for admins and old rows), `body` = content (1 – 2,000), `screenshot_asset_id`, `screenshot_deleted_at`, `guest_email` (guests only, ≤ 254), `context` (route, screen, browser), `created_at`, `assigned_owner_account_id`, `priority` LOW / MEDIUM / HIGH, `status` NEW / IN_REVIEW / DONE (renamed in place, no reopen), `resolution_note`, `updated_at`; `account_id` nullable for guests. 90-day retention: `FEEDBACK_SCREENSHOT_RETENTION_DAYS`, `screenshotExpiresAt`, `isScreenshotExpired`. **The deletion job is ADMIN-PROD-05's** (daily; clears the asset and sets `screenshot_deleted_at`, which a CHECK keeps consistent).

## 12. Account action foundation (`account-actions.ts`, PD-7)
Reused: `account_deletion_requests` (+ `status` PENDING / PROCESSED / DECLINED, `handled_by_account_id`, `handled_at`). New: `account_action_requests` (target account, filing unit, requester, action LOCK / DEACTIVATE / SOFT_DELETE, reason ≤ 500, status, handler; one PENDING per account and action). Execute: `account:administer`, PLATFORM_ADMIN only (`mayExecuteAccountAction`); file: `account:escalate` on exactly the unit (`mayEscalateAccountAction`). Effects as data (`ACCOUNT_ACTION_EFFECT`); `HARD_DELETE_IN_PORTAL = false`. Execution: ADMIN-PROD-05, which must also check the target is a member of the filing unit (contract: "members of its unit").

## 13. Category / config foundation (`categories.ts`)
`vocabulary_items` as is (label, sort_order, ACTIVE / ARCHIVED). `CATEGORY_POLICY` covers exactly the six existing `vocabulary_types` (test-checked): COUNTRY, REGION, DOMAIN, SKILL, SPECIALIZATION — create, label, order, archive; VENTURE_STAGE — label and order only. No type creation, no deletion, no config / CMS engine.

## 14. Notification foundation (`notifications.ts`)
`notifications` (recipient, type, resource, created_at, read_at); types VERIFICATION_APPROVED / _REJECTED, VENTURE_REVIEW_APPROVED / _REJECTED, each tied to its resource type by a CHECK. `notify(exec, …)` writes in the caller's transaction; `decisionNotification` maps a decision to its type. A verification submission is the handlers' queue count, not a row (contract §22). No e-mail / Slack.

## 15. Audit foundation (`admin-audit.ts`)
Reuses `audit_events` via `writeAudit`. `writeAdminAudit`: actor, target (type, id), action, timestamp, before / after status, scope `organization_id`, optional `reason`. `assertAuditSafe` is an allowlist: snake_case keys without password, token, session, cookie, email, phone, body, content, answer, screenshot, document, file, note, bio, name, title, reason (singular or plural; reason only through its field); values null, boolean, number, a UUID under `*_id`, or a code under status / state / role_code / capability / source / action / kind / type / priority. No free text can enter. The 26 admin codes are typed in `AdminAuditAction`; this task writes `ACCESS_GRANTED`, `ACCESS_REVOKED`, `VERIFICATION_REQUEST_SUBMITTED`.

## Related
- [ADMIN-PROD-02-rbac-scope-foundation.md](ADMIN-PROD-02-rbac-scope-foundation.md) · [ADMIN-PROD-02-db-migration.md](ADMIN-PROD-02-db-migration.md) · [ADMIN-PROD-02-qa-handoff.md](ADMIN-PROD-02-qa-handoff.md) · [ADMIN-PROD-01-data-api-handoff.md](ADMIN-PROD-01-data-api-handoff.md)
