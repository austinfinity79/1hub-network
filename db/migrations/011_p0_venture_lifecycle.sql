-- 011_p0_venture_lifecycle.sql — TASK 22-L1-L2-SOT-REALIGN, WF02 (DEC-L2R-D4..D7).
--
-- The BA workbook of 28/09 (sheet "2. Actor", rows 89, 90, 102) and the L2
-- board ask a venture for its stage and for the role its creator states, and a
-- team member for a permission level. The schema could hold none of them:
--
--   projects.stage_id          one item of the controlled type VENTURE_STAGE
--   projects.owner_role_label  the role the creator states, display text
--   project_members.permission EDIT ("Biên tập") or VIEW ("Xem")
--
-- NOTHING HERE IS A PLATFORM PERMISSION. `owner_role_label` is display text
-- like `project_members.role_label`. `permission` is the level of one member
-- in one venture: EDIT may update that venture, VIEW may read it. The owner is
-- still `projects.owner_profile_id` alone ("Chủ sở hữu") and has no row in
-- `project_members`. Capabilities on the platform still come only from
-- role_assignments.
--
-- Rows that exist keep what they could do: members were read only, and VIEW is
-- the default.
--
-- REFERENCE DATA. The five stages are the ones PRJ1 draws, in its order. The
-- final list is the PO's and is managed as data (ACTIVE / ARCHIVED).
--
-- ADDITIVE ONLY. No backfill, no existing value changes.

BEGIN;

INSERT INTO vocabulary_types(code, label) VALUES
  ('VENTURE_STAGE', 'Giai đoạn')
ON CONFLICT (code) DO NOTHING;

-- Fixed ids, so the reference rows are the same in every environment.
INSERT INTO vocabulary_items(id, type_code, slug, label, sort_order) VALUES
  ('23000000-0000-0000-0000-000000000001', 'VENTURE_STAGE', 'idea', 'Ý tưởng', 10),
  ('23000000-0000-0000-0000-000000000002', 'VENTURE_STAGE', 'prototype', 'Prototype', 20),
  ('23000000-0000-0000-0000-000000000003', 'VENTURE_STAGE', 'pilot', 'Pilot', 30),
  ('23000000-0000-0000-0000-000000000004', 'VENTURE_STAGE', 'selling', 'Đang bán', 40),
  ('23000000-0000-0000-0000-000000000005', 'VENTURE_STAGE', 'scaled', 'Đã mở rộng', 50)
ON CONFLICT DO NOTHING;

ALTER TABLE projects
  ADD COLUMN stage_id uuid NULL REFERENCES vocabulary_items(id),
  ADD COLUMN owner_role_label text NULL;

ALTER TABLE project_members
  ADD COLUMN permission text NOT NULL DEFAULT 'VIEW'
    CONSTRAINT ck_pm_permission CHECK (permission IN ('EDIT', 'VIEW'));

COMMIT;
