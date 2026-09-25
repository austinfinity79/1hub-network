# WF03 — HUB / CHAPTER / CLB OPERATIONS — FINAL v1.0

**Mode:** Production / Internal Operations  
**Actor:** HUB Leader / Chapter Admin / authorized organization representative  
**Goal:** Operate a HUB/Chapter/CLB unit: members, programmes, profile/content, events and organization relationships.  
**Result:** unit data and member relationships are managed in one inherited, auditable system rather than personal files/accounts.

## Final flow / screen set

```text
WF03-S01 Select / manage HUB-Chapter-CLB
→ WF03-S02 Unit Dashboard
→ WF03-S03 Member/Account List
→ WF03-S04 Member/Account Detail
→ WF03-S05 Programme/Challenge List for the unit
→ WF03-S06 Unit Content & Profile Management
→ WF03-S07 Event Management
→ WF03-S08 Unit Settings / Organization Relationships
→ WF03-S09 Public Unit Page
```

These are module navigation destinations, not a forced linear wizard.

## Screen contracts

| ID | Route | Source | Responsibility | Required scope |
|---|---|---|---|---|
| WF03-S01 | `/ops/network` | ADM8 | select/list managed Chapter/CLB and inspect member counts | `network:read` |
| WF03-S02 | `/ops/org/:orgId` | ORG1 | operational unit dashboard / aggregate status | `org:read` |
| WF03-S03 | `/ops/org/:orgId/members` | ADM17 | searchable/filterable account/member list | `member:read` |
| WF03-S04 | `/ops/org/:orgId/members/:profileId` | ADM18 | member/account detail and allowed ops actions | `member:read`; mutations separately scoped |
| WF03-S05 | `/ops/org/:orgId/programmes` | ADM5 | programmes/challenges associated with unit | `programme:read` |
| WF03-S06 | `/ops/org/:orgId/profile` | ORGP2 | manage organization profile/content groups | `org:manage` |
| WF03-S07 | `/ops/org/:orgId/events` | Chapter Summit admin reference | create/manage **Event** records and registrations/operations as authorized | `event:manage` |
| WF03-S08 | `/ops/org/:orgId/settings` | ADM21 | parent/child/partner/co-organizer relationships + settings; preserve history | `org:manage_relationship` |
| WF03-S09 | `/organizations/:slug` | Chapter Profile reference | public organization/chapter page | public/network visibility rules |

## Thảo review change — frozen terminology

```text
OLD: Quản lý hoạt động
NEW: Quản lý sự kiện
```

Implementation rule:

- use the canonical `Event` entity;
- `Event.programme_id` may be nullable so standalone events remain possible;
- do not introduce a generic editable `Activity` CRUD module to satisfy WF03;
- system-generated `ActivityRecord` remains a history/audit/enrichment concept, not the same thing as Event.

## Authorization rule

Frontend route access is convenience only. Backend authorization checks `role + organization scope + capability` for every mutation.

Examples:

```text
Chapter Admin in Chapter A ≠ permission over Chapter B
Organization Representative ≠ HUB System Admin
Member relationship history cannot be silently deleted when a role changes
```

## Content boundary

WF03 may manage the unit's own public/profile content. It does not absorb the full Programme/Challenge lifecycle, which belongs to WF04.
