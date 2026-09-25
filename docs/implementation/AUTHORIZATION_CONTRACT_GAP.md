# Authorization Contract Gap

M0-T09 stopped before implementing the authorization matrix. The frozen SOT names roles and names capabilities, but **no frozen source ever joins the two**. Building the matrix would require inventing the mapping, which the task forbids.

No code was written. The working tree is unchanged.

## The two halves that never meet

**Role side** — `03_AUTH_RBAC_ARCHITECTURE_v1.0.md:101-113`. A matrix of 11 prose actions against the 4 P0 roles, with scope qualifiers. Contains **zero** capability identifiers.

| Prose action | Individual | HUB Member | Community Leader | Platform Admin |
|---|---|---|---|---|
| View own profile | ✓ | ✓ | ✓ | by admin policy |
| Edit own profile | ✓ | ✓ | ✓ | admin support only |
| Edit own visibility | ✓ | ✓ | ✓ | support/audit only |
| Submit feedback | ✓ | ✓ | ✓ | ✓ |
| View own membership/history | ✓ | ✓ | ✓ | ✓ |
| View organization member list | — | — | scoped org only | ✓ |
| View member detail for ops | — | — | scoped org only | ✓ |
| Confirm membership | — | — | scoped org only | ✓ |
| Manage leadership records | — | — | if policy allows | ✓ |
| View P0 aggregate metrics | — | — | optional scoped | ✓ |
| Manage controlled vocab | — | — | — | ✓ |

**Capability side** — `WF03:28-35` and `05_API_CONTRACT:1087-1090`. Ten identifiers, each bound to a screen or endpoint group. Contains **zero** role codes.

| Capability | Bound to | Source |
|---|---|---|
| `network:read` | WF03-S01 `/ops/network` | WF03:28 |
| `org:read` | WF03-S02 `/ops/org/:orgId` | WF03:29 |
| `member:read` | WF03-S03, S04 | WF03:30-31, API:1087 |
| `programme:read` | WF03-S05 | WF03:32 |
| `org:manage` | WF03-S06 | WF03:33, API:1088 |
| `event:manage` | WF03-S07 | WF03:34, API:1089 |
| `org:manage_relationship` | WF03-S08 | WF03:35, API:1090 |
| `profile:read:self` | session DTO example | API:135 |
| `profile:update:self` | session DTO example | API:136 |
| `network:read:self` | session DTO example | API:137 |

Verified by grep: the role matrix contains 0 capability identifiers, and no frozen document contains a role code and a capability identifier in the same statement.

## Why this cannot be bridged without guessing

Joining the halves needs an assertion the SOT never makes. Even the closest pair is inference:

> `03:107` says Community Leader may "View organization member list", scoped. `WF03:30` says that screen requires `member:read`. Concluding `HUB_COMMUNITY_LEADER → member:read` asserts that the prose action *is* that identifier. Plausible, but it is my equivalence, not the contract's.

Four capabilities have no corresponding prose row at all, so not even inference reaches them: `org:read`, `network:read`, `programme:read`, `event:manage`.

Two further mappings are named but have **no identifier anywhere**: the membership mutation capability (`WF03:31` "mutations separately scoped", `API:1087` "mutation capability") and leadership management (`03:110`).

## Additional ambiguity

`WF03:4` declares the actor as "HUB Leader / Chapter Admin / authorized organization representative". None of those three labels is a role code. `HUB_COMMUNITY_LEADER` is plausible for the first; "Chapter Admin" matches no catalogue entry; "authorized organization representative" resembles `ORGANIZATION_REPRESENTATIVE`, which `03:86-93` marks as designed-but-not-active in P0.

Two capability naming conventions also coexist with no statement of which is canonical: `resource:action:scope` (API:135-137) and `resource:action` (WF03, API:1087-1090).

## What unblocks this

One table, authored as a contract amendment to `03_AUTH_RBAC_ARCHITECTURE_v1.0.md` section 5. Filling these 40 cells makes M0-T09 immediately implementable.

| Capability | INDIVIDUAL_USER | HUB_MEMBER | HUB_COMMUNITY_LEADER | PLATFORM_ADMIN | Scope rule | Lifecycle rule |
|---|---|---|---|---|---|---|
| `profile:read:self` | ? | ? | ? | ? | ? | ? |
| `profile:update:self` | ? | ? | ? | ? | ? | `profile.status != DEACTIVATED` (03:125) |
| `network:read:self` | ? | ? | ? | ? | ? | ? |
| `network:read` | ? | ? | ? | ? | ? | ? |
| `org:read` | ? | ? | ? | ? | ? | ? |
| `member:read` | ? | ? | ? | ? | ? | ? |
| `programme:read` | ? | ? | ? | ? | ? | ? |
| `org:manage` | ? | ? | ? | ? | ? | ? |
| `event:manage` | ? | ? | ? | ? | ? | ? |
| `org:manage_relationship` | ? | ? | ? | ? | ? | ? |

Also needed: an identifier for the membership mutation capability and for leadership management, and a ruling on which naming convention is canonical.

## What is NOT blocked

Everything except the matrix is fully specified and could be built the moment the table exists:

| Component | Frozen source |
|---|---|
| Evaluation rule: authenticated AND role permits AND scope contains AND relationship valid AND visibility/consent allows AND assignment active | `03:36-42` |
| Scope types: PLATFORM, ORGANIZATION, PROGRAMME, EVENT, TEAM, STARTUP, SOLUTION | `03:65-73` |
| Policy predicates, including `hasRole(HUB_COMMUNITY_LEADER, ORGANIZATION, chapter_id)` | `03:121-151` |
| Lifecycle conflict returns 409 | `05:1096` |
| `SCOPE_FORBIDDEN` error code | `05:812` |
| RoleAssignment shape with `valid_from` / `valid_to` | migration 002 |
| Deterministic actors holding real catalogue codes | M0-T07 seed |

## Related

- [db-schema-gaps-p0.md](DB_SCHEMA_GAPS_P0.md) — schema gap register
- [p0-decisions-required.md](P0_DECISIONS_REQUIRED.md) — earlier decision memo
- [claude-latest-report.md](CLAUDE_LATEST_REPORT.md) — latest task report
