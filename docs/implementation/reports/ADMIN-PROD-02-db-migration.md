# ADMIN-PROD-02-db-migration

**Evidence 16 – 18, 21, 22: DB impact matrix, migration 017, Sprint1 coexistence, location, fresh and upgrade databases.** Parent: [ADMIN-PROD-02-rbac-scope-foundation.md](ADMIN-PROD-02-rbac-scope-foundation.md). File: `db/migrations/017_p0_admin_foundation.sql` (each change and WHY in its header).

> **Superseded in part (ADMIN-PROD-07-CONTRACT-FIX):** revoke authority is now exact-unit only ([DEC-ADM-D02](../../decisions/DECISION_LOG.md#dec-adm-d02)); `account:escalate` and the leader account-request route are withdrawn ([DEC-ADM-D04](../../decisions/DECISION_LOG.md#dec-adm-d04)). Historical evidence below is kept as recorded.

## 16. DB impact matrix
| Domain | Class | Change | WHY |
|---|---|---|---|
| roles / delegation | ADD_COLUMN + ADD_CONSTRAINT | `role_assignments.capability`; `ck_role_assignments_capability_scope` | PD-6 scoped capability on the existing grant record; a capability grant is organization-scoped |
| organizations / hierarchy | REUSE_EXISTING | — | lifecycle = `publication_status`; hierarchy = PARENT relationships |
| role verification | NEW_TABLE_REQUIRED + ADD_INDEX | `role_verification_requests`, enum `verification_request_status`, `uq_rvr_declared_position` | `uq_open_membership` allows one open membership per (profile, unit): it cannot hold several positions, past terms or a routed unit |
| verification effects | REUSE_EXISTING | `leadership_records`, `community_memberships` | ADMIN-PROD-03 writes them on approval |
| venture fields | ADD_COLUMN + ADD_CONSTRAINT | `projects.website`, `projects.logo_asset_id`; `ck_projects_website`, `ck_projects_logo_asset` | PD-3 |
| venture review | NEW_TABLE_REQUIRED + ADD_INDEX | `venture_reviews`, enums `venture_review_kind` / `_status`, `uq_venture_reviews_pending` | PD-2: unapproved values must live apart from the live public row; no `project_status` change |
| feedback | ADD_COLUMN + ADD_CONSTRAINT | 9 columns, enums `feedback_type` / `_priority`, `feedback_status` renamed in place, 5 checks, `account_id` nullable | PD-5 / FB-01 fields; guests have no account |
| account deletion | ADD_COLUMN + ADD_CONSTRAINT | `status`, `handled_by_account_id`, `handled_at`; `ck_account_deletion_handled` | PD-7: processed / declined by PLATFORM_ADMIN |
| account escalation | NEW_TABLE_REQUIRED + ADD_INDEX | `account_action_requests`, enums `account_action`, `account_request_status`, `uq_account_action_pending` | PD-7: a leader's request has no other home (deletion requests are one per account, self only) |
| notifications | NEW_TABLE_REQUIRED | `notifications`, enum `notification_type` | contract §22: read state per recipient |
| categories | REUSE_EXISTING | — | `vocabulary_items` label / order / status |
| location | REUSE_EXISTING (here) | — | §19 below |
| audit | REUSE_EXISTING | — | `audit_events` |
| queue / audit indexes | none | — | only with query-plan evidence (contract); ADMIN-PROD-03 measures `routed_to_org_id` |
No admin user store, review queue, admin organization tree, capability table or media subsystem.

## 17. Migration result
Next number (017), one transaction. Existing-data STOP check: feedback text outside 1 – 2,000 characters. Every new column nullable or defaulted; feedback rows typed OTHER, deletion requests PENDING; no row deleted. Documented manual rollback refuses unless every new structure is empty, so it is lossless or does nothing. Compatibility: additive for production `78f21f2`; one operational rule — close capability-only grants before an application rollback below 017 (none can exist before ADMIN-PROD-04). Runner: checksum recorded, applied once, edits refused.

## 18. Sprint1 coexistence (no fork)
| Sprint1 item | State | ADMIN-PROD-02 |
|---|---|---|
| S1-UAT-03 / 03B RoleVerificationRequest | no code on any branch | owns the table (contract no-fork rule: first lander owns); UAT fields (unit, title incl. Tên Ban / ghi rõ, from / to MM/YYYY, current flag = no end, PENDING, receiving unit) all fit; S1 reuses it unchanged |
| S1-UAT-02 / FB-01 feedback | no code | owns the columns; FB-01 fields (3 types, ≤ 2,000, screenshot ≤ 5 MB, guest e-mail, URL / step / browser / user) all fit |
| S1-UAT-06 venture website / logo / submit | no code | owns `website`, `logo_asset_id`, `venture_reviews`; UAT "Mã số doanh nghiệp" is excluded by PD-3 (PO), not added |
| auth replacement | independent | nothing in 017 touches auth |
| location (PD-4) | not started | nothing added (below) |
No SPRINT1_CONFLICT; no temporary model.

## §19 Location (no conflict)
PD-4 storage is `country_vocab_id` + `region_vocab_id` (existing) + `location_text` (≤ 60). 017 adds no location column: `location_text` belongs to the Sprint1 location feature. Admin only manages COUNTRY / REGION items (`CATEGORY_POLICY`), which carries the hybrid rule unchanged (VN provinces as REGION items, other countries' regions optional, OTHER an item).

## 21. Fresh database (`admin-migration.db-test.ts`)
Scratch database, runner 001 → 017 then the seed: ledger = every file in order with 017's checksum; exactly the four admin tables and frozen enums exist; no `admin_users` / `review_queue` / `capability_grants` / `admin_organizations`; seeded grants carry no capability. The shared DB was also rebuilt with `db:reset` (017 applied, seed applied).

## 22. Upgrade database
Scratch database at the production schema (001 – 016, ledger written as the runner does) with seed, feedback in NEW / REVIEWED / CLOSED, a deletion request and a public venture; runner → 017 only (016 skipped). Pre-017 columns of the four altered tables byte-identical (row digest); statuses → NEW / IN_REVIEW / DONE, type OTHER, account kept; deletion request PENDING; the previous release's actor query runs unchanged. RECOVERY: STOP leaves ledger and data untouched; rollback refused while a capability grant exists; rollback lossless back to 016 (enum labels restored); re-apply clean.

## Related
- [ADMIN-PROD-02-data-foundation.md](ADMIN-PROD-02-data-foundation.md) · [ADMIN-PROD-02-qa-handoff.md](ADMIN-PROD-02-qa-handoff.md) · [ADMIN-PROD-01-implementation-plan.md](ADMIN-PROD-01-implementation-plan.md)
