# WF02 Screen Implementation Plan

Derived from [WF02_PRE_IMPLEMENTATION_AUDIT.md](WF02_PRE_IMPLEMENTATION_AUDIT.md) and updated after the **WF02 decision freeze** (2026-09-26, [DEC-WF02-H1..H13](../decisions/DECISION_LOG.md#dec-wf02-h1)). Ordered by data and API dependency. **WF02-T00 (foundation) is implemented**; no screen body yet.

## Readiness after the freeze
| Order | Screen | Route | Frozen P0 scope | Dependencies | Readiness |
|---|---|---|---|---|---|
| 0 | WF02 Foundation | — | Member shell: P0 links live, the rest inert, no counters (H9). `GET /me/network`: memberships, leadership, venture relations, `activity_summary: []` (H5). PROFILE_DISCOVERY projection helper | WF01 services | **DONE** (WF02-T00) |
| 1 | S01 Account home | `/me` | Summary, server completion + neutral missing-group copy (H13), navigation cards, "Tổ chức của tôi". "Đang chờ bạn" omitted (H10). No public link (H3) | 0 | **DONE** (WF02-S01) |
| 2 | S03 Privacy | `/me/privacy` | PROFILE_DISCOVERY, consent history, re-acceptance (H4) | 0 | **DONE** (WF02-S03) |
| 3 | S04 Roles & links | `/me/roles` | Memberships, leadership, venture roles with source label; membership request → PENDING_APPROVAL (H5, H11) | 0 | **DONE** (WF02-S04) |
| 4 | S02 Profile edit | `/me/profile/edit` | Canonical IndividualProfile fields + Experience / Development goal / Current need (H1, H2). Activity panel Future | 0 | **DONE** (WF02-S02) |
| 5 | S07 Settings | `/me/settings` | Sessions list, revoke one, revoke all, deletion request (H8) | 0; P13 deletion subset; revoke-all API addendum | **DONE** (WF02-S07; migration 006) |
| 6 | S05 Project/Startup | `/projects/new`, `/projects/:id/edit` | Five fields; owner-only write; review button omitted (H6, H7) | 0; venture taxonomy migration ([DEC-WF02-VENTURE-TAXONOMY-STORAGE](../decisions/DECISION_LOG.md#dec-wf02-venture-taxonomy-storage)) | **DONE** (WF02-S05; migration 007; DEC-WF02-S05-G1..G5) |
| 7 | S06 Team | `/projects/:id/team` | Owner manages invitations/roles; members read-only; no permission tiers (H7) | 6; P12 | **HUMAN DECISION REQUIRED** (OPEN-WF02-S06 G1–G8; then migration 008 = P12) — [preflight](WF02_S06_PREFLIGHT_AUDIT.md) |

**Order unchanged:** Foundation → S01 → S03 → S04 → S02 → S07 → S05 → S06. No decision creates a new dependency. After the foundation, S03, S04, S02 and S07 are independent of each other.

## Prior human gaps
| Gap | Status | Record |
|---|---|---|
| H1 Completion reachability | CLOSED | [DEC-WF02-H1](../decisions/DECISION_LOG.md#dec-wf02-h1) |
| H2 S02 write scope | CLOSED | [DEC-WF02-H2](../decisions/DECISION_LOG.md#dec-wf02-h2) |
| H3 Public / preview | CLOSED | [DEC-WF02-H3](../decisions/DECISION_LOG.md#dec-wf02-h3) |
| H4 S03 scope | CLOSED | [DEC-WF02-H4](../decisions/DECISION_LOG.md#dec-wf02-h4) |
| H5 S04 scope | CLOSED | [DEC-WF02-H5](../decisions/DECISION_LOG.md#dec-wf02-h5) |
| H6 Venture fields | CLOSED (storage gap opened) | [DEC-WF02-H6](../decisions/DECISION_LOG.md#dec-wf02-h6) |
| H7 Venture team / capabilities | CLOSED | [DEC-WF02-H7](../decisions/DECISION_LOG.md#dec-wf02-h7) |
| H8 S07 scope | CLOSED | [DEC-WF02-H8](../decisions/DECISION_LOG.md#dec-wf02-h8) |
| H9 Member shell | CLOSED | [DEC-WF02-H9](../decisions/DECISION_LOG.md#dec-wf02-h9) |
| H10 "Đang chờ bạn" | CLOSED | [DEC-WF02-H10](../decisions/DECISION_LOG.md#dec-wf02-h10) |
| H11 Membership request | CLOSED | [DEC-WF02-H11](../decisions/DECISION_LOG.md#dec-wf02-h11) |
| H12 Short full-page refs | CLOSED | [DEC-WF02-H12](../decisions/DECISION_LOG.md#dec-wf02-h12) |
| H13 S01 copy | RESOLVED_BY_PRECEDENCE | [DEC-WF02-H13](../decisions/DECISION_LOG.md#dec-wf02-h13) |
| Venture region/domain storage | CLOSED | [DEC-WF02-VENTURE-TAXONOMY-STORAGE](../decisions/DECISION_LOG.md#dec-wf02-venture-taxonomy-storage) |

**Remaining WF02 human decisions: 0.**

## Authorized work (not yet started)
| Kind | Item | Task |
|---|---|---|
| DB | P12 additive migration: invitations, target email/identity, team lifecycle, integrity | S06 (with S05) |
| DB | P13 subset: account deletion request only — **done** (migration 006) | S07 |
| DB | Venture taxonomy: `projects.region_id` + `project_domains` — **done** (migration 007) | S05 |
| API | `/me/network` (**done**, T00), `/me/membership-requests`, `/me/profile` allowlist (H1/H2), `/me/sessions` + revoke-all addendum, `/me/account-deletion-request`, `/ventures*` (5 fields), `/ventures/{id}/team*` | per screen |
| Authz | `venture:read`, `venture:manage`, `venture:team_manage` added to the Matrix §E — **done** | S05 |
| QA | Short full-page crop rule in the pixel harness | first WF02 pixel task |

## Happy paths
| ID | Path | Status |
|---|---|---|
| HC-WF02-01 | Completed member opens `/me` | **PASS** (WF02-S01) |
| HC-WF02-02 | Member edits profile incl. H1 groups, completion recalculates | **PASS** (WF02-S02) |
| HC-WF02-03 | Member changes PROFILE_DISCOVERY | **PASS** (WF02-S03) |
| HC-WF02-04 | Network-visible profile | Owner view only; `/profiles/{id}` UI not in P0 (H3) |
| HC-WF02-05 | Roster member sees membership/leadership | **PASS** (WF02-S04) |
| HC-WF02-06 | Unmatched member requests membership → PENDING_APPROVAL | **PASS** (WF02-S04) |
| HC-WF02-07 | Member creates canonical Project/Startup | **PASS** (WF02-S05) |

## Related
- [WF02_PRE_IMPLEMENTATION_AUDIT.md](WF02_PRE_IMPLEMENTATION_AUDIT.md) — findings
- [WF02_HUMAN_DECISION_PACKET.md](WF02_HUMAN_DECISION_PACKET.md) — packet
- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — DEC-WF02 records
- [P0_STATUS.md](P0_STATUS.md) — status
