# P0 Decisions Required

Classification of the five BLOCKING gaps from M0-T06A against frozen source precedence. Audit only: nothing was implemented, no migration was created, no seed or contract was changed.

## Precedence applied

Both frozen precedence lists rank the sources, so two frozen documents at **different** ranks cannot genuinely conflict. Precedence decides.

| Rank | CLAUDE.md section 1 | Master Spec section 0 |
|---|---|---|
| 1 | Business SOT / workflow docs | Business SOT |
| 2 | **Data SOT + data freeze** | **Data SOT** |
| 3 | Design Pixel SOT + screen contracts | Design Pixel SOT |
| 4 | **Architecture + API contract** | SA Master Spec |
| 5 | CLAUDE.md | Code, never silently overrides SOT |
| 6 | Existing code | — |

**Correction to M0-T06A.** That report classified B1 as a genuine SOT conflict. That was wrong. I treated "two frozen sources disagree" as automatically genuine without checking that `CLAUDE.md` section 1 explicitly ranks them. The Data Decisions Freeze sits at rank 2 and the API contract at rank 4, so the disagreement is resolved by precedence, not deadlocked.

---

## B1 — Profile completion group 3

| | |
|---|---|
| **Conflict** | Group 3 is "Current role/headline" or `NETWORK_CONTEXT` |
| **Source A** | `00_DATA_DECISIONS_FREEZE_v1.1.md:100` — normative table, rank 2 |
| **Source B** | `05_API_CONTRACT_P0_v1.0.md:348` — JSON example response, rank 4 |
| **Classification** | RESOLVED_BY_PRECEDENCE |
| **Human decision** | NO on which value wins. YES to authorize editing the frozen API contract text |
| **Downstream** | Contract correction |

Three independent reasons the freeze wins:
1. Rank 2 outranks rank 4.
2. The freeze is a normative table with a completion rule and weight per group; the API text is an illustrative example payload, not an enum or a specification.
3. The API variant contradicts the freeze internally. `00_DATA_DECISIONS_FREEZE_v1.1.md:77` states the pending-membership fallback "must not block completion of the P0 profile". Scoring `NETWORK_CONTEXT` would cap an unmatched user at 90 percent, which is exactly that prohibition.

**Resulting rule.** The ten completion groups are the freeze list. Group 3 is Current role/headline. `NETWORK_CONTEXT` is **not** a completion group. `completion_percent = completed_groups * 10`. Completion is derived server-side; the client never submits it.

**Answering special point B: membership does not affect profile completion.** No completion group depends on membership, so neither a pending nor an inactive membership can block 100 percent.

---

## B2 — Seeded role codes

| | |
|---|---|
| **Conflict** | Seed writes `ORG_ADMIN` and `PLATFORM_OPS` |
| **Source A** | `1HUB_DATA_SOT_v1.1.md:316` — ten-role catalogue, rank 2 |
| **Source B** | `03_AUTH_RBAC_ARCHITECTURE_v1.0.md:80-93` — same roles split into 4 P0-active and 8 later, rank 4 |
| **Classification** | INVALID_SEED_ASSUMPTION |
| **Human decision** | NO |
| **Downstream** | Deterministic seed (M0-T07) |

There is **no conflict between the two sources**: the architecture doc partitions the Data SOT list into P0-active and later, and is consistent with it. Verified by grep: `ORG_ADMIN` and `PLATFORM_OPS` appear in **zero** frozen SOT documents. They exist only in `db/seed/seed_dev.sql:65-66` and in my own audit reports quoting it. They were invented for seed convenience.

**Resulting rule.** Authoritative catalogue is the Data SOT ten. P0-active are `INDIVIDUAL_USER`, `HUB_MEMBER`, `HUB_COMMUNITY_LEADER`, `PLATFORM_ADMIN`. The deterministic seed maps `ORG_ADMIN` to `HUB_COMMUNITY_LEADER` and `PLATFORM_OPS` to `PLATFORM_ADMIN`.

---

## B3 — RoleAssignment anchor and validity columns

| | |
|---|---|
| **Conflict** | Anchored on `account_id` or `individual_profile_id`; three columns missing |
| **Source A** | `1HUB_DATA_SOT_v1.1.md:297-305` — rank 2 |
| **Source B** | `03_AUTH_RBAC_ARCHITECTURE_v1.0.md:53` — rank 4 |
| **Classification** | STALE_LOWER_PRIORITY_SCHEMA |
| **Human decision** | NO on the value. YES to authorize creating migration 002 |
| **Downstream** | Migration 002 |

Both higher-ranked sources **agree exactly**: `individual_profile_id`, `role_code`, `scope_type`, `scope_id`, `valid_from`, `valid_to`, `status`, `assigned_by`. Only `001_p0_init.sql:218-228` differs, using `account_id` and omitting `valid_from`, `valid_to`, `assigned_by`. Code is the lowest rank and "never silently overrides SOT".

**Resulting rule.** RoleAssignment anchors on `individual_profile_id` and carries validity dates and `assigned_by`, so the "assignment is active" clause of the authorization rule has something to evaluate.

---

## B4 — Seed is neither deterministic nor idempotent

| | |
|---|---|
| **Conflict** | Seed behaviour contradicts its own README |
| **Source A** | `db/seed/SEED_README.md:6` and `CLAUDE.md:58` require fixed UUIDs and a deterministic fixture |
| **Source B** | `db/seed/seed_dev.sql` uses `now()` in five inserts, omits ids on four tables, and lacks `ON CONFLICT` on two |
| **Classification** | INVALID_SEED_ASSUMPTION |
| **Human decision** | NO |
| **Downstream** | Deterministic seed (M0-T07) |

Measured on live PostgreSQL in M0-T06A, not inferred: a second run took `leadership_records` from 1 to 2 and `role_assignments` from 2 to 4; across a reset, membership ids and `events.starts_at` both changed. The file contradicts its own stated contract, so there is no source conflict to resolve.

---

## B5 — Seed leaves eleven tables empty

| | |
|---|---|
| **Conflict** | Frozen flows have no fixture |
| **Source A** | `00_DATA_DECISIONS_FREEZE_v1.1.md:57` preseed primary path; `:76` pending-state UI; WF01-S07 consent |
| **Source B** | Live introspection: 11 tables empty, including `consent_records`, `membership_bootstrap`, `user_sessions` |
| **Classification** | INVALID_SEED_ASSUMPTION |
| **Human decision** | NO |
| **Downstream** | Deterministic seed (M0-T07) |

No SOT disagreement: the seed simply does not cover flows the freeze requires. Notably no `PENDING_APPROVAL` membership exists, so the frozen pending-state UI cannot be rendered.

---

## Lifecycle states, special point D

All resolved the same way: Data SOT rank 2 versus migration rank 6. All belong to migration 002.

| Entity | Data SOT states | Migration can store | Verdict |
|---|---|---|---|
| Profile | `DEACTIVATED` (:182) | `INACTIVE` | Rename, SOT wins |
| Membership | `+ WITHDRAWN, SUSPENDED, ALUMNI` (:190) | `CLOSED` only | Add, SOT wins |
| Leadership | `ALUMNI, REVOKED` (:193) | shared enum | Add, SOT wins |
| Event | `+ LIVE, ENDED, CANCELLED` (:213) | 3 of 6 | Add, SOT wins |
| EventRegistration | full lifecycle (:216) | no table | Create, SOT wins |
| Organization | separate `verification_status` (:196-198) | publication only | Add, SOT wins |

## Responsibility split, special point E

| Downstream task | Gaps |
|---|---|
| Migration 002 | B3, plus all lifecycle states above |
| Deterministic seed (M0-T07) | B2, B4, B5 |
| Contract correction | B1 (API contract example payload) |
| Human decision on substance | None |
| Human authorization to amend a frozen artifact | Two: the API contract text, and creating migration 002 |

## Related

- [db-schema-gaps-p0.md](DB_SCHEMA_GAPS_P0.md) — full compatibility matrix
- [claude-latest-report.md](CLAUDE_LATEST_REPORT.md) — latest task report
