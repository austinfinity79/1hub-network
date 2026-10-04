# ADMIN-PROD-04-prod05-handoff

**Evidence 27: exact handoff to ADMIN-PROD-05 (feedback, categories, account operations APIs).** Parent: [ADMIN-PROD-04-qa.md](ADMIN-PROD-04-qa.md). ADMIN-PROD-05 is not started.

> **Superseded in part (ADMIN-PROD-07-CONTRACT-FIX):** revoke authority is now exact-unit only ([DEC-ADM-D02](../../decisions/DECISION_LOG.md#dec-adm-d02)); `account:escalate` and the leader account-request route are withdrawn ([DEC-ADM-D04](../../decisions/DECISION_LOG.md#dec-adm-d04)). Historical evidence below is kept as recorded.

## Feedback (PD-5, FB-01) — `feedback:manage`, platform only
| Ready | To build |
|---|---|
| `feedback_submissions` extended by 017 (type, context, screenshot + deletion time, guest e-mail, priority, owner, resolution note, updated_at; statuses NEW / IN_REVIEW / DONE) | `GET /ops/feedback` (the A05 placeholder in the YAML), `GET …/{id}`, `PATCH …/{id}` (type incl. OTHER, priority, owner, status, note) with `canTransitionFeedback`, `GET /ops/feedback/summary?week=` (ISO week: type × open / closed, priority, owner — `summaryBucket`) |
| `src/lib/admin/feedback.ts`: statuses, transitions, types, priorities, limits, `screenshotExpiresAt`, `isScreenshotExpired` | the daily 90-day job: clear `screenshot_asset_id`, set `screenshot_deleted_at`, remove the file; no job runner exists in the repo, so the task chooses one (VPS cron calling a script, or a guarded ops endpoint) |
| `FEEDBACK_UPDATED` typed | reviewer access to screenshots: a media-route branch like the logo one (holder of `feedback:manage`, asset referenced by a feedback row) |
Open: `POST /feedback` is Sprint1 FB-01's (the `RECEIVED` response label, schema gap D3); a guest screenshot has no account to own it in the media store — FB-01 / PROD-05 must agree an owner marker.

## Categories — `vocabulary:manage`, platform only
Ready: `CATEGORY_POLICY` (`src/lib/admin/categories.ts`) over the six existing types; `vocabulary_items` as is; `assertSelectable` keeps existing selections of an archived item valid. To build: `GET /ops/categories/{type}`, `POST …/{type}` (slug fixed at creation, label, sort_order), `PATCH …/{type}/{id}` (label, order, ACTIVE / ARCHIVED); VENTURE_STAGE label and order only; no type creation, no deletion; `VOCABULARY_ITEM_CREATED` / `_UPDATED`.

## Account operations (PD-7)
| Ready | To build |
|---|---|
| `account_action_requests`, `account_deletion_requests.status / handled_by / handled_at` (017) | `POST /ops/organizations/{orgId}/members/{profileId}/account-requests` (`account:escalate` on exactly the unit; **the target must be a member of that unit** — open since ADMIN-PROD-02) |
| `src/lib/admin/account-actions.ts`: `ACCOUNT_ACTION_EFFECT`, `mayExecuteAccountAction`, `mayEscalateAccountAction`, `canTransitionAccountRequest`, `HARD_DELETE_IN_PORTAL = false` | `GET /ops/account-requests`, `POST …/{id}/process` · `…/decline`, `POST /ops/accounts/{id}/lock` · `unlock` · `deactivate` · `reactivate` (`account:administer`) |
| `revokeAllSessionsForAccount` (`src/lib/auth/sessions.ts`) | effects: status updates, sessions revoked, scoped role assignments closed on deactivate, retention flag on soft delete; refuse acting on oneself; `ACCOUNT_*`, `ACCOUNT_REQUEST_*` audit |

## Patterns to reuse
Pre-transaction self-action refusal with audit; row `FOR UPDATE` with scope in the statement; status (+ version where the row has one) checked inside the lock; grant re-read FOR SHARE; keyset cursor (`submitted_at` / `created_at`, id); strict bodies and parameters (422); optional idempotent operation per mutation family (contract amendment A11); out-of-scope ids answer like unknown ones.

## Carried items (not PROD-05 unless the PO assigns them)
| Item | Note |
|---|---|
| organization lifecycle APIs (`org:lifecycle`: create DRAFT, activate, deactivate) | in the ADMIN-PROD-01 plan for PROD-04, not in the PROD-04 task contract; unassigned |
| ops entry for capability-only grantees | ADMIN-PROD-06 |
| S1-UAT-03B / S1-UAT-06 cut-overs (onboarding requests, venture submit / save, legacy conversion) | Sprint1 |
| rollback rule for capability-only grants (017 header) | live now that the access API exists |

## Related
- [ADMIN-PROD-04-qa.md](ADMIN-PROD-04-qa.md) · [ADMIN-PROD-02-data-foundation.md](ADMIN-PROD-02-data-foundation.md) · [ADMIN-PROD-01-data-api-handoff.md](ADMIN-PROD-01-data-api-handoff.md)
