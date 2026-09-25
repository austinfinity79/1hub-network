# WF02 — MEMBER PROFILE & NETWORK MANAGEMENT — FINAL v1.0

**Mode:** Production 29/09  
**Actor:** Member / Leader  
**Goal:** Maintain Individual Profile, visibility, network relationships and the Project/Startup profile owned or managed by the member.  
**Result:** canonical member and venture data remain reusable by WF05 and later programme flows.

## Final flow

```text
WF02-S01 Account Home
├─→ WF02-S02 Edit Individual Profile
├─→ WF02-S03 Privacy & Visibility
├─→ WF02-S04 Roles & Network Links
├─→ WF02-S05 Create/Edit Project or Startup Profile
│      └─→ WF02-S06 Manage Project/Startup Team
└─→ WF02-S07 Account Settings
```

WF02 does **not** execute programme participation. WF05 consumes the Project/Startup profile created here.

## Screen contracts

| ID | Route | Source | Responsibility | Primary read/write |
|---|---|---|---|---|
| WF02-S01 | `/me` | ME0 | account/profile summary, completion, invitations, organization links | account/profile/network read model |
| WF02-S02 | `/me/profile/edit` | PRO2 | edit canonical Individual/Founder profile sections | IndividualProfile |
| WF02-S03 | `/me/privacy` | ME2 | per-purpose visibility/consent management; viewer history where allowed | Visibility + consent read/write |
| WF02-S04 | `/me/roles` | ME6 | system-recorded memberships, leadership, organization/project roles and activity trail | read-only role/link history |
| WF02-S05 | `/projects/:id/edit` or `/projects/new` | PRO1 | create/edit canonical Project/Startup profile | Project/Startup |
| WF02-S06 | `/projects/:id/team` | PRO3 | manage team membership/roles within permitted scope | Team / venture membership |
| WF02-S07 | `/me/settings` | ME4 | account settings, session/security, notifications and account lifecycle controls | UserAccount settings |

## Thảo review change — frozen

WF02 **must include create/edit Project Profile** and link it to WF05.

Architecture rule:

```text
WF02 creates/maintains the canonical Project/Startup object.
WF05 references that same object when applying/participating in a Programme/Challenge.
Never create a duplicate project copy per programme.
```

## Profile trust rule

UI must distinguish where relevant:

```text
self-declared
system-recorded
organization/HUB-confirmed
verified later
```

System-recorded role/activity history is not directly editable by the user.

## Explicit non-goals in WF02

- task/project management board;
- generic sprint/task tracking;
- programme application lifecycle;
- judging/review;
- investor dataroom.
