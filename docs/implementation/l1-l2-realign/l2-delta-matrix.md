# L2 Delta Matrix

WF-02 Personal Workspace: Profile, Project & Startup Management. "Row" is the row of sheet `2. Actor`. Type: B business, U screen, D data, A API.

## Workspace and profile
| SOT requirement | Frame | Route | Today | Match | Change | Type |
|---|---|---|---|---|---|---|
| Enter Hồ sơ của tôi or Dự án & startup của tôi (row 85) | FP1-OWN, ME7 | `/me`; no list route | overview page; ventures listed inside it | **no** | owner profile at `/me`; list at `/projects` | U A |
| Show profile, activity, experience, achievements, linked ventures, pending invitations (row 86) | FP1-OWN, ME7 | `/me` | profile summary, ventures as owner or ACTIVE member; `activity_summary` always empty; invitations nowhere | **no** | experience, education, links, ventures, pending invitations; activity and achievements have no source ([D-P1](open-decisions.md)) | U D A |
| Update profile, experience, links, contact, visibility (row 87) | FP1-OWN pencils, L12 dialog, ME0 | `/me/profile/edit`, `/me/privacy`, `/me/settings` | editor page; experience title and organisation only; no contact data | partly | in-place dialogs; experience period and description; phone | U D A |

## Venture
| SOT requirement | Frame | Route | Today | Match | Change | Type |
|---|---|---|---|---|---|---|
| Create Dự án / Ý tưởng or Startup (row 88) | PRJ1 | `/projects/new` | `project_type` PROJECT or STARTUP, radio | yes | none | — |
| Name, field, description, stage, role (row 89) | PRJ1 | `/projects/new` | name, domains, summary, region; **stage and role not collected** | **no** | stage (five values of the board), creator role (Founder, Co-founder, Thành viên) | B U D A |
| AI from pitch deck or website | PRJ1 | — | none | **no** | no provider: block drawn, action inert ([D-A1](open-decisions.md)) | B |
| Creator is the owner | PRJ1 note | — | `owner_profile_id`; owner has no member row | yes | creator role stored with the venture; ownership unchanged | D |
| Draft by default (row 92) | PRJ3 | — | insert writes `DRAFT`; no code changes status | yes | none | — |
| Public only when eligible (row 92) | PRJ3 | — | no public reader of `projects` | contained | no criteria in any source: stays draft ([D-V1](open-decisions.md)) | B |
| No duplicate on refresh or double submit | PRJ1 | `POST /ventures` | client guard only; the route ignores `Idempotency-Key` | **no** | server idempotency on create | A |
| Completion status (row 103) | PRJ3 "Hồ sơ 6/48 trường" | — | none | **no** | the 48 fields are not defined anywhere ([D-V2](open-decisions.md)) | B D |

## Team
| SOT requirement | Frame | Route | Today | Match | Change | Type |
|---|---|---|---|---|---|---|
| Invite by e-mail (row 90) | PRJ2 | `/projects/[id]/team` | pending row; **no e-mail is sent** | partly | invitation e-mail through the existing sender | A |
| Invite by link (row 90) | PRJ2 | — | none | **no** | semantics not defined ([D-T1](open-decisions.md)) | B D A |
| Role and permission (row 90, 102) | PRJ2 "Ba mức quyền" | — | `role_label` free text; owner-only edit; no permission level | **no** | permission Chủ sở hữu, Biên tập, Xem enforced by the server | B D A |
| Member confirms, membership updated (row 91) | ME7 banner | `/projects/[id]/team` | accept and decline exist; only reachable by opening the team page | partly | pending invitations listed for the invitee in ME7 | U A |
| Invitee without an account | PRJ2 row 3 | — | allowed; cannot sign in unless provisioned | **no** | works once sign-up is open | B |
| Non-owner cannot change owner-only state | — | — | owner-only checks, IDOR tests | yes | extended to the permission levels | A |
| Activity history (row 104) | — | — | `audit_events`; venture create and update write none | partly | audit for venture create and update | A |
| Feedback button (row 93) | "Góp ý" pill | — | none | **no** | [D-F1](open-decisions.md) | B U |

## Data that the schema cannot hold today
| Field | Needed by | Present |
|---|---|---|
| venture stage | PRJ1, ME7 | no |
| creator role | PRJ1, PRJ2 | no |
| member permission | PRJ2 | no |
| invitation link token | PRJ2 | no |

## Related
- [overview.md](overview.md) · [l1-delta-matrix.md](l1-delta-matrix.md) · [open-decisions.md](open-decisions.md)
