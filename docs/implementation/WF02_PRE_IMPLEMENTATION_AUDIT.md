# WF02 Pre Implementation Audit

**Verdict: HUMAN DECISION REQUIRED.** Audit only: no runtime, DB or SOT change. Date: 2026-09-26; HEAD `a8da0a9`.

Sources:
- WF02 = `WF02_MEMBER_PROFILE_NETWORK_FINAL_v1.0`
- SCR = Screen Contracts
- API = `05_API_CONTRACT_P0` (§5, screen map §WF02)
- SOT = Data SOT
- Freeze = Data Decisions Freeze
- Matrix = `AUTHORIZATION_CAPABILITY_MATRIX_P0`
- DB = migrations 001–005
- Ref = `design-reference/final/WF02` (all 14 bitmaps inspected)

## 1. Screen inventory (7, all Production per WF02 "Mode: Production 29/09")
| Screen | Route | Purpose | Reference / mode | Pixel config |
|---|---|---|---|---|
| S01 | `/me` | Account home: summary, completion, invitations, organisation links | ME0, strict | full 837 < 900: **gap** |
| S02 | `/me/profile/edit` | Edit canonical individual/founder profile | PRO2, strict | full 620 < 900: **gap** |
| S03 | `/me/privacy` | Per-purpose visibility/consent, viewer history | ME2, long-page (1125) | ready |
| S04 | `/me/roles` | Read-only memberships, leadership, roles, activity | ME6, long-page (1594) | ready |
| S05 | `/projects/new`, `/projects/:id/edit` | Create/edit canonical Project/Startup (one bitmap also serves create) | PRO1, strict | full 883 < 900: **gap**; create state not drawn |
| S06 | `/projects/:id/team` | Team membership and roles | PRO3, strict | full 719 < 900: **gap** |
| S07 | `/me/settings` | Account, sessions, notifications, deletion | ME4, long-page (1355) | ready |

Every frozen route exists (M0-T03 placeholders). **No WF02 screen for `/profiles/{id}`**, although the API (§5.2) and three bitmaps ("Xem hồ sơ công khai", "Xem bản public", "Xem hồ sơ như người khác thấy") need one.

## 2. Boundary (kept separate)
| Entity | WF02 role | Storage |
|---|---|---|
| IndividualProfile | read/edit (S01, S02) | `individual_profiles` + domains/skills/experience/education/links |
| Visibility / Consent | S03 manages (separate records) | `profile_visibility_settings`, `consent_records` |
| CommunityMembership, LeadershipRecord | **read-only** (S01, S04); no approval admin (WF03) | `community_memberships`, `leadership_records` |
| RoleAssignment | read-only display (S04) | `role_assignments`; never granted by WF02 |
| Project/Startup ("Venture" in API) | **WF02 creates/edits canonical record**, reused by WF05. Workflow contract (priority 3) outranks SOT's "Startup owner WF05" (priority 4): **RESOLVED_BY_PRECEDENCE** | `projects` (type PROJECT/STARTUP, `owner_profile_id`), `project_members` |
| OrganizationRepresentation | not in any WF02 screen | no table |

## 3. Findings by area
| Area | Finding |
|---|---|
| **Profile / completion** | The S02 bitmap shows only headline, bio (≤ 60 words), domain group and external links, plus an "ẩn mục trong tiến trình" panel. **No approved UI anywhere (WF01+WF02) for experience, development goal, current need or skills**, so groups 8–10 are unreachable and the ≥80% KPI cannot be met (**H1/H2**). S01 copy says "còn thiếu ảnh và **học vấn**", but education is not a completion group (**H13**). Algorithm unchanged |
| **View vs edit** | Owner DTO (`/me/profile`) ≠ network projection (`/profiles/{id}`, not implemented). The projection must filter by PROFILE_DISCOVERY (D2/D2A fields) **before** serialisation and never include email or contact (**H3**) |
| **Visibility** | S03 repeats the S07 purpose toggles: investor, challenge-owner and recruitment are Future (DEC-WF01-S07-D3); "Google tìm thấy" and S02 "Hồ sơ đang public" contradict D2 (network-only, guests denied). Only PROFILE_DISCOVERY (NETWORK_ONLY/PRIVATE) is frozen; no other group code. **VISIBILITY GROUP CONTRACT GAP** for anything more (**H4**) |
| **Consent** | S03 shows no consent history, re-acceptance or revocation UI, although SCR/WF02 assign "consent management" to S03; post-onboarding re-acceptance was deferred to WF02-S03 (DEC-WF01-S07-D8). Viewer log (`ProfileViewerLog`) and "Tải toàn bộ dữ liệu" (`export_my_data`) have no table or API (**H4**). PRODUCTION_LEGAL_CONTENT_REQUIRED carries |
| **Media** | The media rule holds. Any projection must emit an avatar URL only when discovery allows it; `/media/assets/:id` still enforces |
| **Network** | Roster bootstrap ready. S04 shows organisation roles plus a "Nhật ký" activity journal. `ActivityRecord` is owned by WF04–WF06 (SOT:116) and its items are challenge/solution events, so it is Future/Demo. Approver provenance ("Trần Quốc Huy duyệt 23/09") has no column (**H5**). `POST /me/membership-requests` exists in the API but **no WF02 screen owns it** (S04 is read-only) (**H11**) |
| **Project/Startup** | S05 draws a 10-group startup form (A–J, "27 bắt buộc · 5 có điều kiện · 16 tuỳ chọn"), including "Trạng thái gọi vốn" and "**Data room**" (investor: WF02 non-goal, Future). No SOT, DB or API defines those fields; `projects` has only name, summary, metadata (**H6, blocking S05**). "Gửi HUB duyệt": `submit-for-review` is conditional and no launch config exists (**H6**) |
| **Ownership / team** | S06 shows permission levels (Chủ sở hữu, Biên tập, Chỉ xem), email invitations, resend, change permission, non-removable owner; S07 shows "Chuyển giao" ownership transfer. **The Matrix has no venture capability; DB has no permission level, invitation email or pending state (P12)** (**H7, blocking S05/S06**). Frozen facts: one owner (`owner_profile_id`), many members (`project_members`, one open membership per person), invitations never auto-activate (§5.4) |
| **Vocabulary** | REGION/DOMAIN/SKILL suffice for S02/S05 domain chips. Startup stage (`STARTUP_STAGE` "schema ready/later") would be needed by S05 group B (under H6) |
| **Organisation data** | `organizations.parent_id` plus `organization_relationships` exist; hierarchy is data-driven, never from text |
| **/me modules** | See the plan. PRODUCTION: identity summary (own email OK), completion, navigation cards, "Tổ chức của tôi" (memberships + owned ventures). DEPENDENCY: "Đang chờ bạn" invitations and decision notifications (no notification/invitation read model, **H10**). Copy claims like S08-D7 (**H13**) |
| **Shell** | S01/S03/S04/S07 share a new member shell. Its dark header nav (Thư viện · Challenge · Sự kiện), bell "2" and sidebar items "Lời mời" and "Tổ chức của tôi" have no P0 screens (**H9**). S02/S05/S06 use an editor header (title + actions) |
| **Settings** | S07: email change (no frozen auth flow); Google link (providers = [] in P0); sessions list with browser/OS/city (`user_sessions` has no device metadata); email notification categories tied to challenges/events (P13 absent); deletion request (P13) and ownership transfer (**H8**) |
| **Discovery** | No member directory in WF02 (WF06 owns discovery/matching). Only the owner's own "view as others" preview |
| **Analytics** | API §10 names `profile_saved`, `visibility_changed`, `membership_requested`, all deferred by DEC-WF01-ANALYTICS-EXT-DEFER; `profile_completion_changed` already covers profile edits. Nothing new required unless un-deferred |

## 4. API matrix
| Endpoint | Screen | Status |
|---|---|---|
| `GET /session`, `GET/PATCH /me/profile`, `GET /me/profile/completion`, `/vocabularies/{type}`, `POST /me/profile/avatar`, `GET/PUT /me/visibility`, `GET /me/consents`, `POST /me/consents/accept`, `/legal/current` | S01–S03 | **READY**. PATCH accepts only the six S06 fields today; S02 needs `bio` limits, links, experience, goal, need (implementation + H1/H2) |
| `GET /me/network`, `GET /me/ventures` | S01, S04 | IMPLEMENTATION MISSING; `roles`/`activity_summary` shape vague (H5) |
| `POST /me/consents/revoke` | S03 | IMPLEMENTATION MISSING; UI placement undecided (H4) |
| `GET /profiles/{id}` | preview/public links | IMPLEMENTATION MISSING; **no screen route** (H3) |
| `POST /me/membership-requests` | none | CONTRACT GAP: no owning screen (H11) |
| `POST/GET/PATCH /ventures*`, `…/submit-for-review` | S05 | IMPLEMENTATION MISSING; field catalogue and review config absent (H6) |
| `/ventures/{id}/team*` | S06 | IMPLEMENTATION MISSING; permission model absent (H7) |
| `/me/settings`, `/me/sessions`, `/me/notification-preferences`, `/me/account-deletion-request` | S07 | IMPLEMENTATION MISSING; scope undecided (H8) |
| viewer log, data export, activity feed, ownership transfer, email change | S03, S04, S07 | CONTRACT GAP / FUTURE |

## 5. DB matrix
| Need | Status |
|---|---|
| Profile full edit, experience, education, links, domains/skills, visibility, memberships, leadership, org hierarchy, projects owner, project members | **DB READY** |
| Startup field catalogue (A–J) | **DB GAP** (only `metadata` jsonb; not frozen) |
| Team permission levels, email invitations, pending/left/removed (P12) | **DB GAP** |
| Notification preferences, deletion requests (P13) | **DB GAP** |
| Session device metadata | **DB GAP** |
| Profile viewer log, activity records, membership approver provenance | **DB GAP** / Future (WF04–06) |

## 6. Security test requirements (for every WF02 task)
Tests must cover:
- `/profiles/{id}` IDOR and PRIVATE → 404 for others; DTO without email/phone/metadata;
- owner mutations ignore any body `profile_id`;
- avatar URL emitted only when allowed;
- membership lists never enumerate other members;
- leadership never becomes RBAC (capabilities stay empty);
- project mutations authorised server-side by owner/member relation (spoofed `owner_profile_id` refused);
- archived taxonomy cannot be newly selected;
- DTOs only, no raw rows.

## 7. WF01 regression gates (every WF02 task)
Re-run completion service tests; media auth; visibility/consent suites; roster (UAT-11); session DTO contract; resolver and `/me` redirects (UAT-03b/10); analytics once-only (UAT-12/13); vocabulary rules; full WF01 UAT + pixel S01–S08.

## 8. External dependencies
The existing three are unchanged: legal content (S03), roster data (S01/S04), taxonomy (S02/S05).

New: none, if H6 keeps the startup catalogue out of P0. Otherwise the startup field catalogue plus `STARTUP_STAGE` vocabulary become new external inputs.

## 9. Human decisions (details and options in [the plan](WF02_SCREEN_IMPLEMENTATION_PLAN.md))
| ID | Question | Recommended |
|---|---|---|
| H1 | How do experience, development goal and current need become editable (no approved UI; ≥80% KPI unreachable)? | Add sections to S02 through a design addendum |
| H2 | S02 editable field set; "ẩn mục trong tiến trình" (no ActivityRecord) | S02 = canonical profile fields; activity panel Future |
| H3 | Public vs network profile: "Hồ sơ đang public", public links vs D2; route for the network projection/preview | Network-only preview route; relabel "public" copy |
| H4 | S03 P0 scope: purpose toggles, viewer log, export, consent history/revocation | PROFILE_DISCOVERY + consent history/re-acceptance; rest Future |
| H5 | S04 activity journal and provenance | Memberships/leadership/project roles only; journal Future |
| H6 | S05 field catalogue (A–J), fundraising, data room, review | **Blocking S05**: freeze a minimal P0 venture field set |
| H7 | Venture permission levels, invitations, transfer | **Blocking S05/S06**: freeze owner/editor/viewer (or owner/member) + capabilities |
| H8 | S07 P0 scope (email change, Google, device list, notifications, deletion) | Sessions list/revoke + deletion request; others Future |
| H9 | Member shell: global nav, bell, sidebar items without screens | Shell with P0 links only |
| H10 | S01 "Đang chờ bạn" source | Omit until an invitation/notification read model exists |
| H11 | Owner of `POST /me/membership-requests` | Defer, or place in S04 with a design addendum |
| H12 | Pixel config: full-page refs shorter than 900 (S01, S02, S05, S06) | Compare the viewport baseline only for these four |
| H13 | S01 copy (education in completion, events/solution claims) | Neutral copy (as S08-D7) |

## Related
- [WF02_SCREEN_IMPLEMENTATION_PLAN.md](WF02_SCREEN_IMPLEMENTATION_PLAN.md) — order and readiness
- [WF01_COMPLETION_AUDIT.md](WF01_COMPLETION_AUDIT.md) — WF01 baseline
- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — decisions
- [P0_STATUS.md](P0_STATUS.md) — status
