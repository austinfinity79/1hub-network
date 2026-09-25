# Claude Task Report

## 1. Task
- Task ID / name: M0-T06B — additive migration 002 for resolved schema gaps
- Scope requested: Create `db/migrations/002_p0_schema_alignment.sql` for the gaps DECISION-P0-01 classified as stale lower-priority schema. No edit to 001, no seed change.
- Status: **DONE**
- Mode: LOCAL REVIEW. Committed locally, not pushed.

## 2. Concurrency warning, read this first
**Another Claude session is running in this same workspace.** While I worked, it committed and pushed three commits: `cfd99ce`, `40ee537`, `3f8a870`. HEAD moved from `c01aaa9` to `3f8a870` mid-task and the remote was pushed, despite this task being LOCAL REVIEW MODE.

Notably, `cfd99ce` committed **my** uncommitted DECISION-P0-01 memo, which that session did not author and could not have reviewed. It also overwrote `CLAUDE_LATEST_REPORT.md` with a DOC-README-01 report.

Nothing of mine was lost: my three M0-T06B files were still uncommitted and untouched, and both prior reports are archived under `reports/`, so replacing the shared report file destroys nothing. But two sessions writing one working tree will eventually clobber real work. Recommend running one session at a time against this repo.

## 3. What migration 002 does
**A. RoleAssignment alignment.** Data SOT:297 and Auth/RBAC:53 agree on the shape; 001 was stale.
- Adds `individual_profile_id`, backfilled from `account_id`, then NOT NULL with a foreign key. The migration raises an exception rather than proceeding if any row cannot be anchored, so no assignment is silently lost.
- Renames `ended_at` to `valid_to` rather than adding a second column meaning the same thing.
- Adds `valid_from` (backfilled from `created_at`, NOT NULL) and `assigned_by` (nullable, since a system grant has no human assigner).
- Replaces `idx_role_actor_scope`, whose name said scope but whose columns did not include it, with `idx_role_profile_scope` on `(individual_profile_id, scope_type, scope_id, state)`.

**B. Lifecycle domains**, each proven by the Data SOT lifecycle section.

| Entity | New domain | SOT |
|---|---|---|
| Profile | `INACTIVE` renamed to `DEACTIVATED` | :182 |
| Event | new `event_status`: DRAFT, PUBLISHED, LIVE, ENDED, CANCELLED, ARCHIVED | :213 |
| Membership | new `membership_state`: PENDING_APPROVAL, ACTIVE, REJECTED, WITHDRAWN, SUSPENDED, ALUMNI | :190 |
| Leadership | new `leadership_state`: ACTIVE, ALUMNI, REVOKED | :193 |

## 4. Two judgement calls worth your review
**Per-entity enums instead of extending the shared ones.** `record_state` is shared by six tables and `publication_status` by three. Adding `LIVE` to `publication_status` would have let an Organization be LIVE, and `ALUMNI` in `record_state` would have let a project member be ALUMNI. The SOT defines these lifecycles per entity, so each entity got its own domain. Both shared enums are verified unchanged and still serve the tables that legitimately use them.

**`account_id` was kept, not dropped.** Dropping it is the cleaner end state and I tried it first. It broke `seed_dev.sql`, which inserts role assignments by account and which this task is forbidden to modify. That would have been a new incompatibility I introduced, not one of the documented B2/B4/B5 defects. So `account_id` is demoted to nullable, documented as transitional via a column comment, and a `BEFORE INSERT` trigger derives the anchor for legacy inserts. The NOT NULL anchor is still enforced. Column and trigger should both be dropped once M0-T07 replaces the seed.

`DEACTIVATED` was renamed rather than added alongside `INACTIVE`, because the decision memo's lifecycle table names both values and records the verdict as "Rename, SOT wins". No row used `INACTIVE`, verified before the change.

## 5. Scope deliberately not taken
Out of scope because they are missing structures rather than stale state domains, each needing its own decision: EventRegistration table, organization `verification_status`, consent record shape, visibility storage, `file_assets`, idempotency key store, provenance vocabulary, venture team state, notification preferences and deletion requests. All remain open in the register.

## 6. Validation
| Gate | Result |
|---|---|
| Fresh PostgreSQL, 001 then 002 | PASS |
| Existing seed after 002 | PASS, with known B2/B4/B5 defects intact and unfixed |
| Schema introspection | PASS, four new/renamed domains correct, shared enums unpolluted |
| DB integration tests | PASS — 19 of 19 |
| Format / Lint / Typecheck | PASS, 0 errors 0 warnings |
| Unit tests | PASS — 61 of 61 |
| Build | PASS |
| Playwright regression | PASS — 64 of 64 |
| App start on 001+002+seed | PASS — `/`, `/api/v1/session`, `/me`, `/ops/network` all 200 |
| Restart persistence | PASS — anchored assignments, new enums and both ledger rows survive |

The DB tests M0-T06A wrote to *record* these gaps are flipped to assert they are closed. That flip is the proof, exactly as the M0-T06A report said it would be.

## 7. Regression
- 001 and the seed are byte-identical: `git diff` reports 0 changed lines on both.
- M0-T01 through T05 green; M0-T06A PostgreSQL foundation green.
- No UI or design file changed; `design-reference/final/**` untouched.

## 8. Remaining known gaps
- **Seed roles.** Still `ORG_ADMIN` and `PLATFORM_OPS`, in no frozen catalogue. Correctly untouched: B2 belongs to M0-T07.
- **Seed determinism.** Still `now()` in five inserts, missing fixed ids on four tables.
- **Seed coverage.** Eleven tables still empty.
- Migration-related blockers remaining: **0**.

## 9. Git
- Branch: `main`
- Implementation commit: see section 11
- Report/final commit: same commit
- Remote: `origin` → `austinfinity79/1hub-network`
- Push status: **NOT RUN** — LOCAL REVIEW MODE
- Remote HEAD: `3f8a870`, moved by the other session, not by me
- Working tree status: clean after my commit

## 10. Files changed
- `db/migrations/002_p0_schema_alignment.sql` (new)
- `src/lib/db/schema.db-test.ts` (gap assertions flipped, alignment assertions added)
- `docs/implementation/DB_SCHEMA_GAPS_P0.md` (B3 and P1–P4 CLOSED; stale enum table and superseded B1 verdict corrected)
- `docs/implementation/CLAUDE_LATEST_REPORT.md` plus archived copy

## 11. Recommended next task
**M0-T07 — deterministic seed system.** It is the last thing between here and a usable fixture set, and it also retires the transitional `account_id` column and trigger that 002 had to keep.

Before that: decide whether to keep running concurrent Claude sessions against this workspace. See section 2.
