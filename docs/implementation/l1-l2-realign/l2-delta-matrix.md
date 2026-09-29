# L2 Delta Matrix

WF-02 Personal Workspace, audited at `5d8cf56` before any L2 code. "Row" is the row of sheet `2. Actor` of the BA workbook; frames are those of the L2 board (FP1-OWN: L1 board). Team, invitations and security: [l2-delta-team.md](l2-delta-team.md).

## Workspace and profile
| SOT requirement | Frame | Current route | Current API | Current DB | Match | Required change |
|---|---|---|---|---|---|---|
| Two entries: Hồ sơ của tôi, Dự án & startup của tôi (row 85) | FP1-OWN, ME7 | `/me` account home; no list route | `GET /me/network` | `projects`, `project_members` | **no** | `/me` becomes FP1-OWN; new `/projects` (ME7) |
| Profile overview: name, role, place, introduction (row 86) | FP1-OWN | `/me` shows name, e-mail, completion only | `GET /me/profile` | `individual_profiles` | **no** | identity card, introduction card |
| Experience with period and description (rows 86, 97) | FP1-OWN, L12 | `/me/profile/edit`: title and organisation only | `PATCH /me/profile` takes period and description since L1 | `profile_experience` | partly | list on FP1-OWN; L12 dialog edits in place |
| Education (row 86, FP1-OWN "Học vấn") | FP1-OWN | not shown, not editable | DTO returns it; `education` refused by PATCH | `profile_education` | **no** | list on FP1-OWN; `education` writable; dialog on the L12 pattern |
| Skills and specialisation | FP1-OWN "Chuyên môn" | editor: one picker over DOMAIN + SKILL, capped at 5 | `domain_ids`, `skill_ids`, `specialization_ids` | three join tables | partly | list on FP1-OWN; editor gets the specialisation picker and loses the cap of 5 (superseded by DEC-L1R-D4) |
| External links (row 97) | FP1-OWN "Thông tin liên hệ" | editor | `links` | `profile_links` | yes | reached from FP1-OWN |
| Contact information (row 87) | FP1-OWN "Thông tin liên hệ" | phone set in onboarding only | `phone` in PATCH | `individual_profiles.phone` | **no** | phone, full name and country editable in the editor |
| Visibility (rows 87, 98) | FP1-OWN "Cài đặt hồ sơ", ME0 | `/me/privacy`, `/me/settings` | `GET/PUT /me/visibility` | `profile_visibility_settings` | yes | reached from FP1-OWN |
| Linked ventures (row 86) | FP1-OWN "STARTUP" card, ME7 | `/me` org rows | `GET /me/network` roles | `projects` | partly | venture card on FP1-OWN; list on ME7 |
| Activity, achievements, badges, viewers, "Dự án trên HUB", timeline, certificates, public URL (row 86) | FP1-OWN | none | none | none | contained | no source: not drawn (D-P1, PO answer) |
| Settings | ME0 | `/me/settings` (L11, TASK 22.3) | sessions, visibility, consents, deletion | — | yes | row "Lời mời đang chờ" gets its source |

## Venture
| SOT requirement | Frame | Current route | Current API | Current DB | Match | Required change |
|---|---|---|---|---|---|---|
| Choose Dự án / Ý tưởng or Startup (row 88) | PRJ1 | `/projects/new` | `POST /ventures` `type` | `projects.type` PROJECT, STARTUP | yes | none; one canonical record |
| Name, field, description, stage, role (row 89) | PRJ1 | step 1: name, field, description, region | `type, name, summary, region_id, domain_ids`; only name required | no stage, no creator role | **no** | name, field, description, stage required; creator role stored; region leaves step 1 |
| AI from pitch deck or website (row 89) | PRJ1 | none | none | none | contained | block drawn, inert: no provider (D-A1) |
| Draft by default (row 92) | PRJ3 | — | insert writes DRAFT; nothing changes status | `project_status` | yes | none |
| Refresh and return keep the record | PRJ1–3 | `?venture={id}&step=` | `GET /ventures/{id}` | — | yes | none |
| No duplicate on double submit | PRJ1 | client guard only | `POST /ventures` ignores `Idempotency-Key` | `idempotency_keys` exists | **no** | server idempotency on create |
| Creator is the owner, from the session (row 100) | PRJ1 note | — | owner from the session; client owner ids refused | `owner_profile_id` | yes | none |
| Public only when eligible (row 92) | PRJ3 "gửi duyệt" | none | `submit-for-review` absent by contract | no public reader | contained | no rule in any source: stays DRAFT and private (D-V1) |
| Completion status (row 103) | PRJ3, ME7 "6/48 trường" | none | none | none | contained | the 48 fields are defined nowhere: not shown (D-V2) |
| Activity history (rows 104, BR-ENT-06) | — | — | venture create and update write no audit | `audit_events` | **no** | audit on create and update |
| Edit the venture later (row 92) | ME7 "Hoàn thiện hồ sơ" | `/projects/:id/edit` | `PATCH /ventures/{id}` | — | partly | stage and creator role editable there |

## Data the schema cannot hold today
| Field | Needed by | Present |
|---|---|---|
| venture stage | PRJ1, ME7, FP1-OWN | no |
| creator role | PRJ1, PRJ2 | no |
| member permission | PRJ2, ME7 | no |
| invitation link token | PRJ2 | no, and not added (D-T1) |

## Related
- [overview.md](overview.md) · [l2-delta-team.md](l2-delta-team.md) · [l2-screen-contracts.md](l2-screen-contracts.md) · [open-decisions.md](open-decisions.md)
