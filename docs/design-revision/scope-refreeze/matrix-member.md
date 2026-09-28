# Matrix Member

Screen / Route / Data / Permission matrix — L2 (12 screens + 1 annotation). Legend as [matrix-homepage-auth.md](matrix-homepage-auth.md). The 28/09 source touches L2 through the canonical Venture (D5) and the `/events` directory (D1); every other L2 decision stands.

| Screen | Route | Actor | Data entities | Permission | Current implementation | Class | Delta | Migration / API | Batch |
|---|---|---|---|---|---|---|---|---|---|
| L10 FP1 Hồ sơ nhà sáng lập | none | member | IndividualProfile (other person) | PROFILE_DISCOVERY | none | FUTURE (HD-08) | — | — | — |
| L11 ME0 Cài đặt | `/me/settings` (+ `/me/privacy`) | owner | Session, ConsentRecord, visibility, deletion request | own | 22.3 overview | ALPHA | — | — | 22.3 done |
| L12 FP1-EDIT Sửa một thẻ | overlay on FP1-OWN | owner | IndividualProfile | own | `/me/profile/edit` (WF02-S02) | FUTURE (HD-05) | — | — | — |
| L13 ME7 Dự án & startup của tôi | none | owner / member | Venture, ProjectMember, invitations | venture relation | list in `/me`; `/demo/projects` | FUTURE (team management and invitation inbox, D5) | — | — | — |
| L13a PRJ1 Tạo — B1 | `/projects/new` | onboarded member | Venture (`projects`, type PROJECT \| STARTUP), domains, region | onboarding DONE; owner = session profile | 22.3 wizard, `POST /ventures` | ALPHA | UI | `?type=STARTUP` preselect for the create-startup intent (HD-A3) | 22.3 done · 22.8 |
| L13b PRJ2 Tạo — B2 Mời đội | `/projects/new?venture=…&step=team` | owner | ProjectMember (invitation) | owner | 22.3, existing invitation API | ALPHA (existing WF02-S06 behaviour; no new team management) | — | — | 22.3 done |
| L13c PRJ3 Tạo xong | `/projects/new?…&step=done` | owner | Venture | owner | 22.3 | ALPHA | — | — | 22.3 done |
| L14 ORGP1 Hồ sơ tổ chức | `/organizations/[slug]`; `/ops/org/:id/profile` | guest / member | Organization (8 types, shared account in the design) | public / `org:manage` | WF03-S09 / S06 | FUTURE (HD-08); candidate frame for chapter information management (HD-A2) | — | — | — |
| L15 DIR1 Thư viện — Bài toán | none | guest | Problem, Venture, IndividualProfile (all not public) | public | none (inert "Thư viện") | FUTURE (problem entity Future; public ventures / founders HD-08); the only challenge / problem directory frame (HD-A7) | — | — | — |
| L16 EV2 Lịch sự kiện | `/events` | guest / member | Event (PUBLISHED, standalone, public orgs), Organization | public | none | **ALPHA** (directory, D1 / D4). Subset: list and chapter filter; no registration button, type chips or seat counts (EventRegistration and event type are Future) | BE | public cross-organisation event list (BD-07); no migration | 22.8 |
| L17 NOTI1 Thông báo | none | member | — | — | inert bell | FUTURE | — | — | — |
| L18 EV1 Chi tiết sự kiện | none | guest / member | Event | public | none | FUTURE (D7: standalone Event Detail; reuse canonical Event later) | — | — | — |
| Cầu nối L2 ↔ L5 | — | — | — | — | — | annotation: PRJ1 and SUB0 create the same canonical Venture (now binding, D5) | — | — | — |

Totals: ALPHA 5 (L11, L13a–c, L16) · FUTURE 7.

## Related
- [matrix-homepage-auth.md](matrix-homepage-auth.md) · [matrix-chapter.md](matrix-chapter.md) · [backend-deltas.md](backend-deltas.md)
