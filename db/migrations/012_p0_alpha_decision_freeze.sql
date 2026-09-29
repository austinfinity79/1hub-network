-- 012_p0_alpha_decision_freeze.sql — TASK 22-L1-L2-PO-DECISION-FREEZE (DEC-PDF).
--
-- The PO froze the open L1 / L2 decisions for Internal Alpha on 2026-09-29.
-- Three of them need the schema:
--
--   projects.visibility            PRIVATE (default) or PUBLIC. A venture
--                                  becomes PUBLIC only when its owner chooses
--                                  "Công khai" and its name, field, description,
--                                  stage and creator role exist (D-V1). A DRAFT
--                                  is never PUBLIC: publishing makes it ACTIVE.
--   VENTURE_STAGE items            relabelled to the frozen list, with stable
--                                  codes as slugs (IDEA, MVP, PILOT, SELLING,
--                                  GROWTH). The ids of migration 011 stay, so
--                                  stored references keep their meaning.
--   community_memberships          `hub_declaration` marks a membership the
--     .hub_declaration             member declared in onboarding (ACC-08). Only
--                                  a platform-wide `membership:confirm` decides
--                                  it (D-H1); a unit's leader does not.
--
-- NOTHING HERE IS A PERMISSION. Capabilities still come only from
-- role_assignments through the approved matrix.
--
-- ADDITIVE. The stage rows and the declaration marker are rows that migrations
-- 010 and 011 introduced and that no deployed environment holds yet.

BEGIN;

ALTER TABLE projects
  ADD COLUMN visibility visibility_level NOT NULL DEFAULT 'PRIVATE',
  ADD CONSTRAINT ck_projects_visibility CHECK (visibility IN ('PRIVATE', 'PUBLIC')),
  ADD CONSTRAINT ck_projects_draft_private CHECK (status <> 'DRAFT' OR visibility = 'PRIVATE');

UPDATE vocabulary_items AS v
   SET slug = s.slug, label = s.label, updated_at = now()
  FROM (VALUES
    ('23000000-0000-0000-0000-000000000001'::uuid, 'IDEA', 'Ý tưởng'),
    ('23000000-0000-0000-0000-000000000002'::uuid, 'MVP', 'MVP'),
    ('23000000-0000-0000-0000-000000000003'::uuid, 'PILOT', 'Pilot / Thử nghiệm'),
    ('23000000-0000-0000-0000-000000000004'::uuid, 'SELLING', 'Đang bán'),
    ('23000000-0000-0000-0000-000000000005'::uuid, 'GROWTH', 'Tăng trưởng')
  ) AS s(id, slug, label)
 WHERE v.id = s.id AND v.type_code = 'VENTURE_STAGE';

ALTER TABLE community_memberships
  ADD COLUMN hub_declaration boolean NOT NULL DEFAULT false;

-- Requests filed from an onboarding declaration carry the stated position or
-- period (migration 010); an ordinary join request carries neither.
UPDATE community_memberships
   SET hub_declaration = true
 WHERE source = 'SELF_DECLARED'
   AND (claimed_position IS NOT NULL OR claimed_period IS NOT NULL);

COMMIT;
