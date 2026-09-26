# WF02 S05 Preflight Audit

**Verdict: HUMAN DECISION REQUIRED (5).** Audit only: no runtime code, no migration. HEAD `c795ee7`, 2026-09-26.

**Sources:** API = `05_API_CONTRACT_P0` §5.3/§12/§16; SCR = Screen Contracts; SOT = Data SOT; DB = `06_DB_SCHEMA_P0` + migrations 001–006; DEC = DECISION_LOG (H3, H6, H7, VENTURE-TAXONOMY-STORAGE).

## 1–3. Entity, type, ownership (existing, frozen)
| Item | Finding |
|---|---|
| Canonical entity | ONE table `projects` (DB §65; API §5.3 calls the resource **Venture**). No separate Startup table; no per-programme copy |
| Columns | `id uuid PK`, `type project_type NOT NULL DEFAULT 'PROJECT'` (PROJECT, STARTUP), `owner_profile_id uuid NOT NULL → individual_profiles`, `slug text NOT NULL UNIQUE`, `name text NOT NULL`, `summary text NULL`, `status project_status NOT NULL DEFAULT 'DRAFT'` (DRAFT, ACTIVE, ARCHIVED), `metadata jsonb NOT NULL DEFAULT '{}'`, `created_at`, `updated_at`; index `(owner_profile_id, status)` |
| Owner | `owner_profile_id`, server-derived (DEC-WF02-H6/H7); one owner; the only writer/manager |
| Members | `project_members(id, project_id, profile_id, role_label, state record_state DEFAULT 'ACTIVE', joined_at, ended_at)`, unique open (project, profile) where ACTIVE. `role_label` = display text only. Team states per SOT arrive with P12 (S06) |
| RoleAssignment | Not involved (H7: capabilities `venture:read` owner + ACTIVE members, `venture:manage` and `venture:team_manage` owner only; minted into the Matrix with S05). No admin shortcut |

## 4–5. Region and domains (decided, not yet stored)
DEC-WF02-VENTURE-TAXONOMY-STORAGE froze `projects.region_id` (nullable, REGION) and `project_domains` (0..n DOMAIN), vocabulary IDs only, ACTIVE-only for new selections, archived links kept, wrong type refused, no duplicates, atomic replace. **Neither exists in the schema** → migration required (section 12).

## 6–7. API and lifecycle
| Endpoint (API §5.3) | Status | Notes |
|---|---|---|
| `POST /ventures` | missing | Body `{type, name, summary, domain_ids, region_id}` (H6); 201 `{id, type, status: "DRAFT", name}` |
| `GET /ventures/{id}` | missing | "Permission-filtered detail"; no frozen DTO beyond the create response |
| `PATCH /ventures/{id}` | missing | "Updates canonical Project/Startup profile"; no body example |
| `GET /me/ventures` | missing | Mapped to S01 in §16; not needed by S05 (S01/S04 use `/me/network`) |
| `POST …/submit-for-review` | missing | Conditional; no launch configuration exists → absent/404 (H6) |

Lifecycle (SOT): `DRAFT → ACTIVE → ARCHIVED`; create → DRAFT (API example). **No frozen trigger** for DRAFT → ACTIVE or → ARCHIVED in P0 (G3). Ownership transfer is Future (H7).

## 8. Authorization gaps
Frozen: owner-only write, members read, capability IDs (H7). Open: **who may create** a venture (G2). Needed tests: owner spoofing (`owner_profile_id`/`profile_id` in body), project-id IDOR (non-member → 404), member read vs edit (403/404), forged `role_label`, invalid/archived/wrong-type REGION and DOMAIN, `metadata`/`slug` never serialised.

## 9. Design mapping (PRO1 bitmap)
| Bitmap element | Class |
|---|---|
| Header name "Tracely" | CANONICAL (`name`) |
| "Hoàn thiện 62% · đã lưu lúc 15:04" | UNSUPPORTED (no venture completion frozen) / "đã lưu lúc" DISPLAY-ONLY |
| "Xem bản public" | FUTURE (H3: no public page) |
| "Gửi HUB duyệt" | FUTURE (H6: no launch config) |
| "Còn 11 trường bắt buộc…", "27 bắt buộc · 5 có điều kiện · 16 tuỳ chọn" | UNSUPPORTED (H6 excludes A–J rules) |
| Navigator A–J (Định danh, Gọi vốn, Bài toán, Bằng chứng, Đội ngũ, Rủi ro, Cập nhật, Tuyển dụng, Data room, Cam kết) | FUTURE / UNSUPPORTED (H6; Data room = WF02 non-goal) |
| Section C (C1 bài toán, C2 ai chịu, C3 cách giải, C5 ảnh sản phẩm) | UNSUPPORTED (not in the H6 write model) |
| Editorial rules panel | UNSUPPORTED |
| `type`, `summary`, `domain_ids`, `region_id` | CANONICAL but **not drawn anywhere** (G1) |
| Create state (`/projects/new`) | not drawn |

**Conflict:** the approved bitmap draws none of the five frozen H6 write fields except the name in the header; almost every drawn element is out of P0 scope. The frame (editor header, canvas, input language) is reusable.

## 10–11. Completion and WF05
- Venture data has no effect on IndividualProfile completion (Freeze §D3 groups contain no venture); no venture completion is frozen.
- WF05 reuse: one canonical `projects` row per venture; `type` distinguishes Project/Startup; programmes must reference it, never copy (WF02 "Thảo review change"). Compatible. WF05 will need `StartupMembership` confirmation (SOT:158) and Solution links: separate WF05 entities, no S05 change.

## 12. Migration proposal (not created)
`007_p0_venture_taxonomy.sql`, additive, older migrations untouched:
```sql
BEGIN;
ALTER TABLE projects ADD COLUMN region_id uuid NULL REFERENCES vocabulary_items(id);
CREATE TABLE project_domains (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vocabulary_item_id uuid NOT NULL REFERENCES vocabulary_items(id),
  PRIMARY KEY (project_id, vocabulary_item_id)
);
CREATE INDEX idx_project_domains_item ON project_domains(vocabulary_item_id);
COMMIT;
```
- Names follow the decision text (`region_id`, `vocabulary_item_id`); the PK prevents duplicates.
- Type (REGION/DOMAIN) and ACTIVE checks happen in the service, as for `profile_domains`.
- No backfill: existing rows keep `region_id` NULL and have no domains.
- Fresh DB and upgrade are both additive.
- The seed test lists `project_domains` as intentionally empty unless a fixture is added.

## Implementation notes (no decision needed)
| Item | Plan |
|---|---|
| Slug | Server-generated opaque unique value; never exposed (no venture route uses it) |
| Required fields | `type`, `name` required (DB NOT NULL); `summary`, `region_id`, `domain_ids` optional (decision) |
| Bounds | Technical only (name 200, summary 2000, ≤10 domains); not business limits |
| `metadata` | Not read or written (H6) |

## Related
- [WF02_SCREEN_IMPLEMENTATION_PLAN.md](WF02_SCREEN_IMPLEMENTATION_PLAN.md) — plan
- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — OPEN-WF02-S05 G1–G5
