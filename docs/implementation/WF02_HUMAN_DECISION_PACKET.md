# WF02 Human Decision Packet

PO/SA decision packet for H1–H13 from [WF02_PRE_IMPLEMENTATION_AUDIT.md](WF02_PRE_IMPLEMENTATION_AUDIT.md). Nothing here is decided or implemented. Date: 2026-09-26.

**How "Blocker" is used here.** YES means the named task cannot start until this is decided. That happens when the decision fixes a data, API or authorization model, or a shared component that four screens reuse. NO means a subset that follows the SOT can be built now, and the decision only adds or removes sections.

**Source abbreviations.**

| Short name | File |
|---|---|
| Freeze | `docs/product/00_DATA_DECISIONS_FREEZE_v1.1.md` |
| SOT | `docs/product/1HUB_DATA_SOT_v1.1.md` |
| WF02 | `docs/workflows/WF02_MEMBER_PROFILE_NETWORK_FINAL_v1.0.md` |
| SCR | `docs/design/SCREEN_CONTRACTS_WF01_WF03_v1.0.yaml` |
| API | `docs/architecture/05_API_CONTRACT_P0_v1.0.md` |
| GAPS | `docs/implementation/DB_SCHEMA_GAPS_P0.md` |
| Matrix | `docs/implementation/AUTHORIZATION_CAPABILITY_MATRIX_P0.md` |
| DEC | `docs/decisions/DECISION_LOG.md` |

---

## H1 — Can ≥80% profile completion be reached through the approved P0 UI?

**Question:** Should P0 expose inputs for EXPERIENCE, DEVELOPMENT_GOAL and CURRENT_NEED, so that the ≥80% completion KPI can actually be reached?

**Why this matters:** The KPI is a roadmap metric, but no approved screen lets a member complete groups 8–10.

**The problem.** P0 completion is 10 canonical groups × 10% (Freeze D3). The approved screens cover only some of them:

| Group | Approved input |
|---|---|
| 1 Full name | WF01-S06 |
| 2 Avatar | WF01-S06 |
| 3 Headline | WF01-S06; WF02-S02 |
| 4 Region | WF01-S06 |
| 5 Bio | WF01-S06; WF02-S02 |
| 6 Domain | WF01-S06; WF02-S02 |
| 7 Skills | WF01-S06 |
| **8 Experience** (≥1 item or `NO_EXPERIENCE_YET`) | **none** |
| **9 Development goal** | **none** |
| **10 Current need** | **none** |

- The most a member can reach through approved UI is **70%**, so `profile_completed_80` can never be true.
- The tables for groups 8–10 already exist.
- The API also stops at group 7: `PATCH /me/profile` accepts only the six WF01-S06 fields.
- 80% is a KPI, not an access gate (Freeze D3), so no user is blocked. **The KPI is simply unmeasurable.**

**Evidence:**
- Freeze §D3 (groups 8–10, `profile_completed_80`); Master Spec v1.3:172
- WF02-S02 bitmap (PRO2): headline, bio, domain group, links only; SCR WF02-S02 `writes: IndividualProfile`
- `src/lib/profile/profile.ts:20` (`PATCH_FIELDS`)

**Recommended option:** Add Experience, Development goal and Current need sections to WF02-S02 through a design addendum, reusing the S02 section pattern.

**Alternative:** Keep the bitmap as drawn and record that the ≥80% KPI cannot be reached in P0. That needs a PO note against Freeze D3's roadmap metric.

**Impact if approved:**
- Business: the ≥80% KPI becomes reachable and measurable.
- Data/API: extend `PATCH /me/profile` to experience items (plus `NO_EXPERIENCE_YET`), goal and need. Tables already exist; no migration.
- Screen(s): WF02-S02 needs a design addendum and a new pixel reference or intentional deviation rows.

**Blocker:** YES
**Blocks:** WF02-S02 (the S02 write scope)

---

## H2 — What exactly may WF02-S02 edit?

**Question:** What is the WF02-S02 editable field set, and does the "ẩn mục trong tiến trình" (hide timeline items) panel ship in P0?

**Why this matters:** The field set fixes the S02 write API; the panel needs activity data that P0 does not produce.

**Evidence:**
- SCR WF02-S02: `reads: ActivityReadModel`; WF02 "Screen contracts" S02 "edit canonical Individual/Founder profile sections"
- SOT:116 — `ActivityRecord` is owned by WF04–WF06; CLAUDE.md §2 — WF04/WF05 are demo-only
- WF02 "Profile trust rule": system-recorded history is not directly editable

**Recommended option:**
- S02 edits the canonical profile fields: the drawn ones plus whatever H1 approves.
- The activity-hide panel is Future. Precedence already settles this part, because no production ActivityRecord exists in P0.

**Alternative:** Ship the panel with an empty state. It would read a read model with no production source.

**Impact if approved:**
- Business: S02 matches canonical profile ownership.
- Data/API: the `PATCH /me/profile` field allowlist is frozen; no activity API.
- Screen(s): WF02-S02; the panel region is classified INTENTIONAL-P0-SCOPE.

**Blocker:** YES
**Blocks:** WF02-S02

---

## H3 — Public profile vs network-only preview

**Question:** How should the "Hồ sơ đang public", "Xem bản public", "Xem hồ sơ công khai" and "Xem hồ sơ như người khác thấy" elements behave, and is a preview route added?

**Why this matters:** The copy promises guest/public visibility, which the frozen P0 policy denies. The preview actions also have no screen route.

**Evidence:**
- DEC-WF01-S07-D2 / D2A: PROFILE_DISCOVERY is NETWORK_ONLY or PRIVATE, never PUBLIC
- SCR: `preview_public` (S02, S05) and `preview_as_other` (S03); API §5.2 `GET /profiles/{id}?view=`
- Screen map / WF02 flow: no `/profiles/:id` route; CLAUDE.md §7 forbids inventing routes

**Recommended option:**
- Add one owner-only, network-view preview route backed by `GET /profiles/{id}?view=network`.
- Relabel the "public" copy to network wording.

**Alternative:** Omit the preview links and the public-status copy in P0 (INTENTIONAL-P0-SCOPE), and keep `/profiles/{id}` for later.

**Impact if approved:**
- Business: members can check what the network sees; there is no public exposure.
- Data/API: `GET /profiles/{id}` with a D2A-filtered DTO (never email or phone); IDOR/PRIVATE tests.
- Screen(s): S01, S02, S03, S05 links and one new preview route (screen map addendum).

**Blocker:** NO
**Blocks:** NONE (it decides the link behaviour on S01/S02/S03/S05)

---

## H4 — WF02-S03 P0 scope

**Question:** Which S03 sections ship in P0?

The candidates are:
- purpose toggles;
- viewer history;
- data export;
- consent history, re-acceptance and revocation.

**Why this matters:** S03's contract lists viewer history and export, but no table or API exists for either.

**Evidence:**
- WF02 S03 "viewer history where allowed"; SCR S03 reads `ProfileViewerLog`, actions `toggle_purpose`, `preview_as_other`, `export_my_data`
- DEC-WF01-S07-D3: Future purposes are not implemented. DEC-WF01-S07-D8: post-onboarding re-acceptance belongs to WF02-S03.
- Freeze §D4: withdrawal semantics "where applicable"; the API has `POST /me/consents/revoke` but no export endpoint

**Recommended option:**
- P0 S03 = PROFILE_DISCOVERY toggle, plus consent history and re-acceptance of stale versions.
- Viewer log and export are Future.

**Alternative:**
- Also ship revocation UI in P0, with its lifecycle effect decided.
- Or authorize a viewer-log table (new migration).

**Impact if approved:**
- Business: closes the DEC-WF01-S07-D8 deferral.
- Data/API: existing consent/visibility services; no migration.
- Screen(s): WF02-S03; the viewer-log and export regions are INTENTIONAL-P0-SCOPE.

**Blocker:** NO
**Blocks:** NONE (it sets the scope of WF02-S03)

---

## H5 — WF02-S04 activity journal and provenance

**Question:** Does S04 show the "Nhật ký" activity journal, and approver provenance ("Trần Quốc Huy duyệt", "HUB tổng gán")?

**Why this matters:** Activity is produced by WF04–WF06, and approver provenance is not stored.

**Evidence:**
- WF02 S04 "…and activity trail"; SCR S04 reads `ActivityRecord`; SOT:116 (owner WF04–WF06)
- GAPS P11: membership `source` provenance is open; API §5.1 `roles: []`, `activity_summary: []`
- WF02 "Profile trust rule": system-recorded vs HUB-confirmed must be distinguishable

**Recommended option:**
- S04 shows memberships, leadership and project roles with their `source` label (self-declared, system-recorded, HUB-confirmed).
- No approver name.
- The journal is Future.

**Alternative:** Authorize a P11 provenance migration so the approver and assigner can be shown.

**Impact if approved:**
- Business: honours the trust rule without fabricated history.
- Data/API: `GET /me/network` shape is frozen; `activity_summary` stays empty.
- Screen(s): WF02-S04.

**Blocker:** NO
**Blocks:** NONE (it sets the scope of WF02-S04)

---

## H6 — WF02-S05 venture field catalogue

**Question:** Which Project/Startup fields does P0 store and edit, and how are they stored?

**Why this matters:** S05's form is its whole write model, and no source defines it beyond five API fields.

**Why it blocks S05.**
- The bitmap draws 10 groups (A–J, "27 bắt buộc · 5 có điều kiện · 16 tuỳ chọn"), including fundraising and Data room.
- The contracts define only `type, name, summary, domain_ids, region_id` (`POST /ventures`).
- The `projects` table stores name, summary, type, owner, status and an unfrozen `metadata` jsonb.
- The required/optional split, validation, `STARTUP_STAGE` usage and storage for the other ~40 fields are undefined.
- Building the form would therefore mean inventing business rules (CLAUDE.md §7).

**Evidence:**
- API §5.3 `POST /ventures`; DB `projects` (06_DB_SCHEMA)
- WF02 non-goals: "investor dataroom"; Freeze §D4 excludes dataroom grants from P0
- API §5.3 `submit-for-review` is conditional (404 unless launch config)

**Recommended option:**
- Freeze a minimal P0 venture field set: the API five, plus any fields the PO explicitly lists, stored in columns or in a frozen `metadata` schema.
- Data room is excluded (already settled by precedence).
- "Gửi HUB duyệt" is shown only when the launch config enables review (already settled by precedence).

**Alternative:** PO supplies the full A–J catalogue with required/conditional rules as an external input (a new external dependency and probably a migration).

**Impact if approved:**
- Business: WF05 reuses a defined canonical venture.
- Data/API: `/ventures*` DTO and validation are frozen; migration only if columns are chosen.
- Screen(s): WF02-S05 (create state not drawn; groups outside the set are INTENTIONAL-P0-SCOPE).

**Blocker:** YES
**Blocks:** WF02-S05, and therefore WF02-S06 and HC-WF02-07

---

## H7 — Venture permissions, team invitations and ownership transfer

**Question:** Who may edit a venture and manage its team? What are the team states and the invitation storage? Is ownership transfer in P0?

**Why this matters:** Every S05 and S06 mutation needs a server-side authorization rule, and none exists.

**Why it blocks S05 and S06.**
- The rule "Creator becomes an authorized management relation according to DB/RBAC schema" (API §5.3) has nothing behind it:
  - the Matrix mints no venture capability ("minted when their workflow implementation freezes them");
  - the DB has only `owner_profile_id`, plus `project_members.role_label` / `record_state`.
- The bitmap's "Chủ sở hữu / Biên tập / Chỉ xem" permission levels appear in no SOT. The API carries only a free-text `role_label`.
- Team lifecycle `PENDING_CONFIRMATION → ACTIVE → LEFT | REMOVED | REJECTED` (SOT) is not in the DB (GAPS P12). There is no email-invitation storage for `POST …/team/invitations`.
- As a result, `PATCH /ventures/{id}` (S05) and every S06 action (invite, change_role, remove_member_if_allowed) cannot be authorized, and the actor + capability + scope + lifecycle check (CLAUDE.md §4) cannot be written.

**Evidence:**
- API §5.3–5.4; SCR S06 actions; Matrix:70
- SOT "Team / Startup membership" lifecycle; GAPS P12; `projects.owner_profile_id` (06_DB_SCHEMA:65)

**Recommended option:**
- Freeze one owner (`owner_profile_id`) plus members:
  - either owner/editor/viewer,
  - or owner-only management with member = read.
- Mint venture capabilities in the Matrix.
- Authorize the P12 migration (team states plus invitation email).
- Ownership transfer is Future.

**Alternative:** Owner is the only writer in P0 (no editor level); S06 permission column shows role_label only. Ownership transfer in P0 would need its own audit rule.

**Impact if approved:**
- Business: team membership needs confirmation and is never activated from an email alone.
- Data/API: P12 migration; venture capability IDs; `/ventures/{id}/team*` DTOs; audit events.
- Screen(s): WF02-S05 (edit authorization), WF02-S06, WF02-S07 "Chuyển giao".

**Blocker:** YES
**Blocks:** WF02-S05, WF02-S06

---

## H8 — WF02-S07 P0 scope

**Question:** Which S07 sections ship in P0?

The candidates are:
- email change;
- Google link;
- session device list;
- notification categories;
- deletion request;
- ownership transfer.

**Why this matters:** Several sections need an auth provider P0 lacks, or tables that do not exist (P13, session device metadata).

**Evidence:**
- SCR S07 `update_email_or_provider_if_supported`; API §5.5 ("only fields explicitly supported by current auth provider", "channels config-driven")
- Auth arch §1: P0 = current/local provider, ExternalIdentity later. So the Google link is already settled by precedence: not in P0.
- GAPS P13 (notification prefs, deletion request); `user_sessions` has no device columns

**Recommended option:**
- P0 S07 = sessions list and revoke (plus logout-all) and the deletion request.
- Email change, Google link, notification categories and transfer are Future.

**Alternative:**
- Authorize P13 for notification preferences too.
- Authorize a session device-metadata migration to match the drawn browser/OS/city rows.

**Impact if approved:**
- Business: account lifecycle controls without unsupported auth flows.
- Data/API: `/me/sessions`, `/me/account-deletion-request` (P13 deletion part).
- Screen(s): WF02-S07.

**Blocker:** NO
**Blocks:** NONE (it sets the scope of WF02-S07)

---

## H9 — Member shell navigation

**Question:** What do the shared member shell's header nav (Thư viện, Challenge, Sự kiện), bell "2", and sidebar items "Lời mời" and "Tổ chức của tôi" link to?

**Why this matters:** Four screens share the shell, and several of its targets have no P0 Production screen.

**Evidence:**
- ME0, ME2, ME6, ME4 bitmaps; screen map (no such WF02 routes)
- CLAUDE.md §2 (WF04/WF05 demo-only) and §7 (no invented routes) vs §5 (do not redesign approved screens). The two sides of this conflict are both CLAUDE.md, so precedence cannot settle it.

**Recommended option:** Render the shell as drawn. Only items with a P0 route are links; the others are inert, and the classification is recorded.

**Alternative:** Hide items that have no P0 screen (INTENTIONAL-P0-SCOPE pixel deviation).

**Impact if approved:**
- Business: no dead or demo links in Production.
- Data/API: none (the bell count needs H10).
- Screen(s): the WF02 foundation shell used by S01, S03, S04, S07.

**Blocker:** YES
**Blocks:** WF02 foundation, and so WF02-S01, S03, S04, S07

---

## H10 — Where "Đang chờ bạn" gets its data (WF02-S01)

**Question:** Which read model feeds the S01 "Đang chờ bạn" block (team invitations, chapter decisions)?

**Why this matters:** SCR S01 reads `Invitations`, but no invitation or notification read model exists.

**Evidence:**
- SCR S01 `reads: Invitations`; API §5.4 invitations (depends on H7); no notification API in §5
- GAPS P12/P13

**Recommended option:** Omit the block in P0 until an invitation read model exists (after H7).

**Alternative:** Show only venture team invitations from P12 once H7 lands.

**Impact if approved:**
- Business: no fabricated pending items.
- Data/API: none now.
- Screen(s): WF02-S01 (region INTENTIONAL-P0-SCOPE).

**Blocker:** NO
**Blocks:** NONE

---

## H11 — Which screen owns the membership request?

**Question:** Which screen hosts `POST /me/membership-requests`?

**Why this matters:** The Freeze requires a P0 request/pending UI, but no WF01/WF02 screen owns it.

**Evidence:**
- Freeze §D2 "P0 UI rule: If not matched: allow declaration/request, display pending state"
- API §5.1 `POST /me/membership-requests` → `PENDING_APPROVAL`
- SCR S04 `writes: []` (read-only)

**Recommended option:** Place the request action in WF02-S04 through a design addendum, and show pending memberships there.

**Alternative:** Defer. This conflicts with Freeze §D2, so it needs an explicit Freeze amendment.

**Impact if approved:**
- Business: unmatched members can ask to join; the request never auto-activates.
- Data/API: `POST /me/membership-requests`.
- Screen(s): WF02-S04 (addendum; S04 contract `writes` changes).

**Blocker:** NO
**Blocks:** NONE (HC-WF02-06 stays open)

---

## H12 — Full-page references shorter than 900 px (pixel QA only)

This is a QA-method question, separate from the business logic.

**Question:** How should full-page QA compare the four WF02 full-page references that are shorter than the 900 px viewport?

The four are S01 = 837, S02 = 620, S05 = 883 and S06 = 719.

**Why this matters:** A full-page browser capture is never shorter than 900 px, so dimensions cannot match. Yet a full-page capture is mandatory before workflow approval.

**Evidence:**
- `design-reference/final/README.md:4` (full.png keeps normalised height, "taller/shorter than 900px")
- QA v1.1 §9 (full-page capture mandatory; never scale to 900)
- `tests/visual/pixel-qa/qa-screens.ts:65` (`SHORT_FULL_PAGE_GAP`, "undefined in the SOT")
- WF03 has 5 more such references (S01, S02, S03, S05, S08)

**Recommended option:** For references shorter than 900, the viewport comparison is authoritative. The full-page comparison crops the capture to the reference height, and anything below it is checked as blank page background.

**Alternative:** Compare the viewport baseline only and waive full-page for these screens (a QA SOT note).

**Impact if approved:**
- Business: none.
- Data/API: none.
- Screen(s): pixel config for WF02-S01, S02, S05, S06 (and WF03 later).

**Blocker:** NO
**Blocks:** NONE for implementation; the WF02 final pixel sign-off

---

## H13 — WF02-S01 copy claims

**Question:** What should S01 say where the bitmap mentions "còn thiếu ảnh và học vấn" and makes event/solution-submission claims?

**Why this matters:** Education is not a completion group, and the claims describe business rules that were never frozen.

**Evidence:**
- Freeze §D3 (10 groups, no education) outranks the design SOT
- CLAUDE.md §3 (completion is server-derived) and §7 (no invented rules); precedent DEC-WF01-S08-D7

**Recommended option:** Copy lists the server's missing groups; neutral text replaces unapproved claims.

**Alternative:** None that is consistent with the SOT.

**Impact if approved:**
- Business: no false claims.
- Data/API: uses `/me/profile/completion`.
- Screen(s): WF02-S01 (COPY rows).

**Blocker:** NO
**Blocks:** NONE

**Status:** RESOLVED_BY_PRECEDENCE (see below)

---

## Decisions already settled by precedence
| H# | Result | Winning source/rule |
|---|---|---|
| H13 | **RESOLVED_BY_PRECEDENCE** | Freeze §D3 (the 10 groups; education is not one) outranks the design bitmap. CLAUDE.md §3 (completion is server-derived) and §7 (never invent business rules), applied as in DEC-WF01-S08-D7 |

**Settled in part, with a human question still open:**

| H# | Settled part | Winning source | Still needs a decision |
|---|---|---|---|
| H2 | Activity-hide panel: no production data | SOT:116 + CLAUDE.md §2 | Field set |
| H3 | No PUBLIC or guest visibility | DEC-WF01-S07-D2 | Preview route or omission |
| H6 | No Data room; review button only when the launch config enables it | WF02 non-goals, Freeze §D4, API §5.3 | Field catalogue |
| H8 | No Google link | Auth arch §1 | Remaining scope |
| H11 | A request UI is required in P0 | Freeze §D2 | Its placement |

## Related
- [WF02_PRE_IMPLEMENTATION_AUDIT.md](WF02_PRE_IMPLEMENTATION_AUDIT.md) — audit
- [WF02_SCREEN_IMPLEMENTATION_PLAN.md](WF02_SCREEN_IMPLEMENTATION_PLAN.md) — plan
- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — where approved decisions get recorded
