# WF02 S06 Preflight Audit

**Verdict: HUMAN DECISION REQUIRED (8).** Audit only: no runtime code, no migration. HEAD `d32cef4`, 2026-09-26.

**Sources:** API = `05_API_CONTRACT_P0` §5.4 (+ yaml); SCR = Screen Contracts WF02-S06; SOT = Data SOT §Team/Startup membership; DB = migrations 001–007 + `06_DB_SCHEMA_P0` §65; GAPS = `DB_SCHEMA_GAPS_P0` P12; DEC = DECISION_LOG (H7, H9, H10, S05-G5); Matrix §E; bitmap = `WF02-S06__project-team__full.png` (1440×719, strict).

## 1. Existing `project_members` (001:258-267, unchanged since)
| Item | Exact state |
|---|---|
| PK / FK | `id uuid PK`; `project_id → projects ON DELETE CASCADE`; `profile_id uuid NOT NULL → individual_profiles` (no cascade) |
| Label / state | `role_label text NULL`; `state record_state NOT NULL DEFAULT 'ACTIVE'` (shared enum: PENDING_APPROVAL, ACTIVE, REJECTED, CLOSED) |
| Time | `joined_at timestamptz NOT NULL DEFAULT now()`, `ended_at NULL`; no `updated_at`, no inviter |
| Uniqueness | `uq_open_project_member (project_id, profile_id) WHERE state='ACTIVE'` |
| Owner | `projects.owner_profile_id` only (DEC-WF02-S05-G5). **Seed conflict:** `seed_dev.sql:71` inserts the Demo Startup owner as an ACTIVE member `'Founder'`; readers already dedupe (`network.ts:163`) |
| Missing for S06 | invitation target (email), SOT states PENDING_CONFIRMATION / LEFT / REMOVED, a pending row without a profile, inviter, invited time |

## 2. P12 (authorized by DEC-WF02-H7, not created)
H7 authorizes invitation persistence, a normalised email target, a per-entity team state enum (not `record_state`) and integrity. It does not fix the **shape** (G1). Proposed `008_p0_venture_team.sql`, option G1(a) (one table, SOT lifecycle on the membership, one `membershipId` space for PATCH/DELETE):

```sql
BEGIN;
CREATE TYPE team_membership_state AS ENUM
  ('PENDING_CONFIRMATION','ACTIVE','LEFT','REMOVED','REJECTED');       -- SOT:204 exactly
DROP INDEX uq_open_project_member;                                     -- predicate depends on the old type
ALTER TABLE project_members ALTER COLUMN state DROP DEFAULT;
ALTER TABLE project_members ALTER COLUMN state TYPE team_membership_state USING (
  CASE state::text WHEN 'ACTIVE' THEN 'ACTIVE' WHEN 'PENDING_APPROVAL' THEN 'PENDING_CONFIRMATION'
                   WHEN 'REJECTED' THEN 'REJECTED' WHEN 'CLOSED' THEN 'REMOVED' END)::team_membership_state;
ALTER TABLE project_members ALTER COLUMN state SET DEFAULT 'ACTIVE';
ALTER TABLE project_members ALTER COLUMN profile_id DROP NOT NULL;   -- pending email invitation
ALTER TABLE project_members ALTER COLUMN joined_at DROP NOT NULL;    -- set on acceptance
ALTER TABLE project_members
  ADD COLUMN invite_email_normalized text NULL,
  ADD COLUMN invited_by_profile_id uuid NULL REFERENCES individual_profiles(id),
  ADD COLUMN invited_at timestamptz NULL,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE project_members
  ADD CONSTRAINT ck_pm_target  CHECK (profile_id IS NOT NULL OR invite_email_normalized IS NOT NULL),
  ADD CONSTRAINT ck_pm_joined  CHECK (state NOT IN ('ACTIVE','LEFT') OR (profile_id IS NOT NULL AND joined_at IS NOT NULL)),
  ADD CONSTRAINT ck_pm_pending CHECK (state <> 'PENDING_CONFIRMATION'
                                      OR (invite_email_normalized IS NOT NULL AND joined_at IS NULL AND ended_at IS NULL)),
  ADD CONSTRAINT ck_pm_email   CHECK (invite_email_normalized IS NULL
                                      OR invite_email_normalized = lower(btrim(invite_email_normalized)));
CREATE UNIQUE INDEX uq_open_project_member ON project_members(project_id, profile_id) WHERE state = 'ACTIVE';
CREATE UNIQUE INDEX uq_pending_project_invitation
  ON project_members(project_id, invite_email_normalized) WHERE state = 'PENDING_CONFIRMATION';
CREATE INDEX idx_pm_pending_email ON project_members(invite_email_normalized) WHERE state = 'PENDING_CONFIRMATION';
COMMIT;
```
Existing rows: all ACTIVE with a profile, so every CHECK holds. Code reading `state = 'ACTIVE'` keeps working (network, roles, venture). Option G1(b), a separate invitations table, needs a state such as ACCEPTED that is not in the SOT. No other collaboration columns (permission tier, expiry, message) are proposed.

## 3–4. Lifecycle and invitation target
| Item | Frozen? | Finding |
|---|---|---|
| States | YES (SOT:204, H7) | `PENDING_CONFIRMATION → ACTIVE → LEFT \| REMOVED \| REJECTED`. **INVITED, DECLINED, EXPIRED are not frozen** and are not used; no expiry in P0 |
| History | YES (API §5.4 "historical relation is preserved"; bitmap card) | Remove = transition + `ended_at`, never `DELETE` |
| Target | YES (API §5.4 body `{email, role_label}`) | Email only. Normalisation = `normalizeEmail` (trim + lower), same as `user_accounts.email_normalized` |
| Activation | YES (§5.4, H7) | An email invitation never creates ACTIVE. **No accept/decline endpoint and no invitee surface exist** (H9 omits "Lời mời", H10 defers the S01 block) → G2 |
| Delivery | Not in P0 | No email provider or outbox (M0 report §16); "Gửi lại" cannot deliver anything → G3 |
| Pending → terminal | Partly | The invitee declines → REJECTED (SOT). Owner cancels a pending invite: not frozen → G6 |

## 5–7. Authority, capabilities, role_label
| Action | Frozen rule | Status |
|---|---|---|
| Invite, change role_label, remove | `venture:team_manage` = owner only (H7, Matrix §E) | Frozen |
| Read team | `venture:read` = owner + ACTIVE members | Frozen; **what a member sees (pending emails?)** not frozen → G8 |
| Member leaves | SOT has LEFT; no endpoint, no design element | G6 |
| Owner leaves / removes self / transfer | Transfer is Future (H7); the owner is not a row | Out of P0 (bitmap badge "Không gỡ được") |
| Team membership → capability | Only `venture:read`; never a RoleAssignment, never from `role_label` | Frozen |
| `role_label` | `text NULL`; API examples "Co-founder"/"Founder"; not a controlled vocabulary | Free display text, optional, owner-edited; bound = technical (D). Bitmap values (Đồng sáng lập, Thành viên, Cố vấn) = DISPLAY examples |

## 8–10. Duplicates, removal, owner protection
| Case | Rule proposed (DB-enforced where frozen) |
|---|---|
| Same profile ACTIVE twice | `uq_open_project_member` (existing) |
| Same email pending twice / concurrent invite | `uq_pending_project_invitation`; unique violation → 409 |
| Invite an ACTIVE member's email | Not checked at invite time (no account lookup: no enumeration). Resolved at acceptance: an already-ACTIVE profile cannot accept twice (unique index) |
| Invite the owner | The owner's own session email → 422; the owner is never a row |
| Remove | `DELETE …/team/{membershipId}`: ACTIVE → REMOVED, `ended_at = now()`; terminal rows → 409; no `DELETE FROM` |
| Owner protection | Team endpoints address `project_members.id` only; the owner has no row, so it cannot be removed; no team endpoint writes `projects.*` |
| Cross-project | Every mutation matches `(id, project_id)` from the path; a mismatch → 404 |

## 11. API (§5.4)
| Operation | Route | Status |
|---|---|---|
| List | `GET /ventures/{id}/team` | Defined, no DTO |
| Invite | `POST /ventures/{id}/team/invitations` `{email, role_label}` → 201 | Defined |
| Update role_label | `PATCH /ventures/{id}/team/{membershipId}` `{role_label}` | Defined (md only, not in the yaml) |
| Remove | `DELETE /ventures/{id}/team/{membershipId}` | Defined (md only) |
| Accept / decline / list my invitations | — | **Missing** (G2) |
| Resend | — | **Missing** (G3) |
| Error codes | No team code frozen | Proposed reuse (D): 409 `MEMBERSHIP_INVALID_TRANSITION`, 422 `PROFILE_VALIDATION_FAILED`, 403 `SCOPE_FORBIDDEN`, 404 `UNCONTRACTED_NOT_FOUND` |
| Audit | No team audit action frozen | G7 |

## 12. Design mapping (PRO3)
| Element | Class | Note |
|---|---|---|
| Header "Tracely · Thành viên đội", "Mời thành viên" | CANONICAL | Shared `EditorHeader`; invite = POST |
| "4 thành viên · 1 lời mời chưa nhận" | DERIVED | Owner + ACTIVE count; PENDING count |
| Columns Thành viên / Vai trò / Tham gia từ | CANONICAL / DERIVED | Name + avatar (media visibility); `role_label`; `joined_at` MM/YYYY |
| Column "Quyền" (Chủ sở hữu / Biên tập / Chỉ xem) | UNSUPPORTED tiers (H7) | H7 says the column shows `role_label`, which duplicates "Vai trò" → G4 |
| Owner row + "Không gỡ được" | DERIVED from `owner_profile_id` | Its role/date have no storage → G5 |
| "Đổi quyền" | UNSUPPORTED as a tier change | → G4 (edit `role_label` and remove) |
| Remove control | Absent from the bitmap | DELETE exists → G4 |
| Pending row (email, "—", "lời mời gửi 20/09") | CANONICAL | `invite_email_normalized`, `invited_at` |
| "Gửi lại" | FUTURE (no delivery) | G3 |
| Card "Ba mức quyền" (data room, nộp giải pháp) | UNSUPPORTED (tiers) / FUTURE (WF05) | Omit |
| Card "Gỡ thành viên không xoá lịch sử" | CANONICAL rule, FUTURE wording (milestones = WF05) | Copy adaptation |
| Empty state, member read-only view | Not drawn | Addendum (G4/G8) |

## 13. Security tests required
IDOR (another venture, random uuid → 404 for both GET and mutations); owner spoofing (`owner_profile_id`, `profile_id`, `state`, `invited_by` in bodies → 422); target spoofing (the invitation email ≠ the session email cannot accept); non-owner mutations (member → 403, stranger → 404); forged `role_label` never changes capabilities; duplicate and parallel invites (one 201, one 409; one DB row); remove → REMOVED with history, second remove → 409; owner removal impossible (no row; a forged id → 404); DTO without `metadata`, slug or the inviter id; email enumeration (the invite response is identical whether or not the email has an account; no account lookup); cross-project `membershipId` → 404; `projects.owner_profile_id` unchanged after every team call.

## 14. WF05 compatibility
Reusable: one `projects` row, owner via `owner_profile_id`, team via `project_members` (SOT TeamMembership = `project_members`, DB §65), the same states. No founder-team copy. Gaps: none new; WF05's programme-specific application roles remain WF05 scope.

## Related
- [OPEN-WF02-S06](../decisions/DECISION_LOG.md#open-wf02-s06-g1) — decisions G1–G8
- [WF02_S05_PREFLIGHT_AUDIT.md](WF02_S05_PREFLIGHT_AUDIT.md) — S05 preflight
- [WF02_SCREEN_IMPLEMENTATION_PLAN.md](WF02_SCREEN_IMPLEMENTATION_PLAN.md) — plan
