# DB Schema Gaps P0

Compatibility audit of the frozen schema against higher-priority SOT, produced by M0-T06A.

Evidence is a **live PostgreSQL 17.6 introspection**, not a documentation reading. `001_p0_init.sql` was applied unchanged (sha256 recorded in `schema_migrations`), `seed_dev.sql` was applied to a fresh database, and every claim below was checked against the running engine. Assertions live in `src/lib/db/schema.db-test.ts`.

**Status update, M0-T06B.** Migration `002_p0_schema_alignment.sql` has been created and applied. Gaps closed by it are marked CLOSED below. Everything else stands unchanged: `001_p0_init.sql` remains byte-identical and the seed is untouched.

## Severity

| Level | Meaning |
|---|---|
| BLOCKING | Blocks the next authorised task, or two frozen SOT sources genuinely disagree |
| PRE-WF | Must be resolved before the named workflow milestone |
| DEFERRED | Real, but nothing in P0 needs it yet |

## Live enum domains (after 002)

| Type | Live values | Note |
|---|---|---|
| `account_status` | ACTIVE, BLOCKED, DEACTIVATED | |
| `profile_status` | DRAFT, ACTIVE, **DEACTIVATED** | renamed by 002 |
| `event_status` | DRAFT, PUBLISHED, LIVE, ENDED, CANCELLED, ARCHIVED | **new in 002** |
| `membership_state` | PENDING_APPROVAL, ACTIVE, REJECTED, WITHDRAWN, SUSPENDED, ALUMNI | **new in 002** |
| `leadership_state` | ACTIVE, ALUMNI, REVOKED | **new in 002** |
| `record_state` | PENDING_APPROVAL, ACTIVE, REJECTED, CLOSED | unchanged, still used by 4 tables |
| `publication_status` | DRAFT, PUBLISHED, ARCHIVED | unchanged, still used by organizations and programmes |
| `org_type` | HUB, CHAPTER, CLB, COMPANY, FUND, PARTNER |
| `project_status` | DRAFT, ACTIVE, ARCHIVED |
| `project_type` | PROJECT, STARTUP |
| `programme_type` | PROGRAMME, CHALLENGE |
| `consent_type` | TERMS_ACCEPTANCE, PRIVACY_DATA_PROCESSING |
| `visibility_level` | PUBLIC, NETWORK_ONLY, PROGRAMME_ACCESS, GRANTED_ACCESS, PRIVATE |
| `vocab_status` | ACTIVE, ARCHIVED |
| `feedback_status` | NEW, REVIEWED, CLOSED |

Clean, no action needed: `visibility_level`, `consent_type`, `programme_type`, `project_type`, `project_status`, `vocab_status`, `account_status`.

## BLOCKING

### B1 — Profile completion groups — **RESOLVED by DECISION-P0-01**
| | |
|---|---|
| Entity | profile completion scoring |
| DB | no column stores group codes or a completion value |
| Required A | `00_DATA_DECISIONS_FREEZE_v1.1.md:100` / `1HUB_DATA_SOT_v1.1.md:595` — group 3 is "Current role/headline" |
| Required B | `05_API_CONTRACT_P0_v1.0.md:348` — group 3 is `NETWORK_CONTEXT`, and no headline group exists |
| Impact | Drives WF01-S06/S08 onboarding UI and the `profiles_at_least_80_percent` KPI. Scoring `NETWORK_CONTEXT` also collides with `FRZ:79`, which says the pending-membership fallback must not block profile completion: an unmatched user caps at 90% |
| Resolution | **Resolved by precedence, not deadlocked.** This entry's original "genuine conflict" verdict was wrong: `CLAUDE.md:3-10` ranks the Data freeze at 2 and the API contract at 4, so the freeze wins. Group 3 is "Current role/headline"; `NETWORK_CONTEXT` is not a completion group; membership never blocks completion |
| Status | Rule settled. No schema change needed, since completion is derived server-side and no column stores it. The API contract's example payload still needs correcting, which requires authorization to edit a frozen document |

### B2 — Role codes are untyped and the seed uses codes in no catalogue
| | |
|---|---|
| Entity/field | `role_assignments.role_code`, `.scope_type` |
| DB | both `text`, unconstrained. Live seed contains `ORG_ADMIN`, `PLATFORM_OPS` |
| Required | `1HUB_DATA_SOT_v1.1.md:316` lists ten role codes; `03_AUTH_RBAC:80-93` lists four P0 roles plus eight later. Neither seeded code appears in either |
| Impact | Blocks M0-T09 RBAC. The seeded leader fails `hasRole(HUB_COMMUNITY_LEADER, ORGANIZATION, chapter)`, so no WF03 ops screen can be authorised or QA'd |
| Resolution | Remap seed codes to the catalogue in the M0-T07 deterministic seed; consider constraining `role_code` in 002 once the catalogue is confirmed |
| Human approval | Required to confirm the canonical role catalogue |

### B3 — RoleAssignment anchor and validity columns — **CLOSED by 002**
| | |
|---|---|
| Entity/field | `role_assignments.account_id`; missing `valid_from`, `valid_to`, `assigned_by` |
| DB | keyed on `account_id`, with only `created_at` / `ended_at` |
| Required | `1HUB_DATA_SOT_v1.1.md:297` and `03_AUTH_RBAC:54` key it on `individual_profile_id`; `03:56-60` and `04:426-429` require the validity columns |
| Impact | Blocks M0-T09. The "role assignment is active" clause of the evaluation rule (`03:42`) has nothing to evaluate beyond a boolean |
| Resolution | Additive migration 002 |
| Status | **CLOSED.** 002 adds `individual_profile_id` (NOT NULL, FK, backfilled), renames `ended_at` to `valid_to`, adds `valid_from` and `assigned_by`, and indexes `(individual_profile_id, scope_type, scope_id, state)`. `account_id` is demoted to nullable and kept only so the frozen seed still applies; a trigger derives the anchor for legacy inserts. Both are transitional and drop after M0-T07 |

### B4 — Seed is neither deterministic nor idempotent
| | |
|---|---|
| Entity | `db/seed/seed_dev.sql` |
| Observed | Second run: `leadership_records` 1 to 2, `role_assignments` 2 to 4. Across resets, membership ids changed `bbd32fd6` to `5a24fbf6` and `events.starts_at` moved `13:40:45Z` to `13:41:28Z` |
| Cause | `now()` in five inserts; ids omitted for `community_memberships`, `leadership_records`, `role_assignments`, `project_members`; no `ON CONFLICT` on two inserts that also lack a unique constraint |
| Required | `SEED_README.md:6` — "Fixed UUIDs in dev seed exist so Playwright/pixel QA gets stable URLs"; `CLAUDE.md:58` — deterministic fixture |
| Impact | Blocks M0-T07 and every authenticated pixel scenario. `PATCH /ops/.../memberships/{id}` has no stable id to address |
| Resolution | Superseding deterministic seed in M0-T07; the frozen file stays untouched |
| Human approval | Already granted in M0-T01 planning; reconfirm |

### B5 — Seed leaves eleven tables empty
| | |
|---|---|
| Empty | `analytics_events`, `audit_events`, `auth_magic_link_requests`, `consent_records`, `feedback_submissions`, `membership_bootstrap`, `organization_relationships`, `profile_education`, `profile_experience`, `profile_links`, `user_sessions` |
| Impact | No fixture for WF01-S07 consent, the D2 preseed primary path (`FRZ:57`), WF03-S08 relationships, or any logged-in visual scenario. No `PENDING_APPROVAL` membership exists, so the frozen pending-state UI (`FRZ:76`) cannot be rendered |
| Resolution | M0-T07 |
| Human approval | Not required |

## PRE-WF

| # | Entity / field | DB now | Required | Source | Milestone |
|---|---|---|---|---|---|
| ~~P1~~ | `profile_status` | **`DEACTIVATED`** | `DEACTIVATED` | SOT:182 | **CLOSED by 002** |
| ~~P2~~ | `events.status` | **6 values, own `event_status`** | + LIVE, ENDED, CANCELLED | SOT:213 | **CLOSED by 002** |
| ~~P3~~ | membership state | **own `membership_state`, 6 values** | + SUSPENDED, ALUMNI, WITHDRAWN | SOT:190 | **CLOSED by 002** |
| ~~P4~~ | leadership state | **own `leadership_state`, 3 values** | + ALUMNI, REVOKED | SOT:193 | **CLOSED by 002** |
| P5 | event registration | no table | table + `registration_enabled` | SOT:216, API:923, SCR:319 | M3 |
| P6 | organizations | `publication_status` only | lifecycle + separate `verification_status` | SOT:196, SOT:198 | M3 |
| P7 | `consent_records` | `accepted_at`/`withdrawn_at` | `status`, `revoked_at`, purpose, scope, recipient, expiry | SOT:275-286, API:1045-1049 | M1 |
| P8 | visibility storage | one row + `group_overrides jsonb` | per-group rows; group code list never frozen | API:440-457, 04:406-411, SOT:268-273 | M1 |
| P9 | `file_assets` | absent | required for avatar upload | 04:304, API:363-374 | M1 |
| P10 | idempotency key store | absent | required by 7 operation classes | API:48-63 | M1 |
| P11 | membership `source` | text, default `SELF_DECLARED`; seed writes `PRESEED` | canonical provenance set | SOT:234-237, API:509 vs API:1060 | M2 |
| P12 | venture team state | `record_state` | PENDING_CONFIRMATION, LEFT, REMOVED | SOT:204, SCR:205-207 | M2 |
| P13 | notification prefs, deletion request | absent | required by WF02-S07 | API:657-665 | M2 |

## DEFERRED

| # | Gap | Source |
|---|---|---|
| D1 | `programme_status` missing CLOSED | SOT:210 |
| D2 | `org_type` missing SCHOOL | SOT:88 |
| D3 | feedback `RECEIVED` not in enum | API:690 vs migration |
| D4 | vocabulary `code` vs `slug` naming | API:723 vs migration |
| D5 | `outbox_events` absent | 04:307, 01:163 |
| D6 | OrganizationRepresentation has no table or endpoint | SOT:201 |
| D7 | Two sources of org parentage: `organizations.parent_id` and `organization_relationships` | SOT:134, WF03:35 |

## Migration 002 — created and applied

`db/migrations/002_p0_schema_alignment.sql` closes B3 and P1 through P4.

Per-entity enums were created rather than extending the shared ones, because `record_state` is shared by six tables and `publication_status` by three. Adding `LIVE` to `publication_status` would have let an Organization be LIVE, and `ALUMNI` in `record_state` would have let a project member be ALUMNI. Both shared enums are verified unchanged.

**Still open for a later migration**, deliberately out of M0-T06B scope because they are missing structures rather than stale state domains: P5 event registration, P6 organization `verification_status`, P7 consent shape, P8 visibility storage, P9 `file_assets`, P10 idempotency store, P11 provenance, P12 venture team state, P13 notification preferences and deletion requests.

## Human decisions required

Resolved by DECISION-P0-01 and implemented by M0-T06B: B1 (freeze wins), B3 (profile anchor).

Remaining:
1. **P8** — the canonical visibility group codes and which storage shape wins.
2. **P10** — approval for an idempotency key table, which the schema SOT does not contain.
3. **B2, B4, B5** — settled in principle; execution belongs to M0-T07.

## Related

- [claude-latest-report.md](CLAUDE_LATEST_REPORT.md) — latest task report
- [browser-testing-rule.md](browser-testing-rule.md) — Playwright authority
- [reports/](reports/) — archived per-task reports
