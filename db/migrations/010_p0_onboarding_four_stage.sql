-- 010_p0_onboarding_four_stage.sql — TASK 22-L1-L2-SOT-REALIGN, WF01 (DEC-L1R-D3..D6).
--
-- The BA workbook of 28/09 (sheet "2. Actor", rows 56–59, 68–69) and the L1
-- board replace the onboarding purpose → profile → privacy with four stages.
-- This migration adds only what the schema could not hold:
--
--   stage 1  full name apart from the display name, country, private phone
--   stage 2  specialisation list (its own controlled vocabulary type)
--   stage 3  self-declared ecosystem roles (multi-select); the HUB units the
--            member names, kept as unsent form data until onboarding is
--            completed; and, on the existing membership request that completion
--            files, the position and period the member stated
--   resume   completion markers for the two stages that have no required field
--
-- Stage 1 needs no marker: it is complete when its required fields exist.
-- `primary_intent` and `purpose_step_completed_at` stay; the new flow does not
-- read them.
--
-- NOTHING HERE IS A PERMISSION. `profile_declared_roles` is a profile
-- attribute used for personalisation. `onboarding_hub_claims` is a draft: a
-- JSON list of { organization_id, position, period } that becomes ordinary
-- membership requests (PENDING_APPROVAL, SELF_DECLARED) when onboarding is
-- completed, and is emptied then. `claimed_position` / `claimed_period` are
-- display text on such a request. Capabilities still come only from
-- role_assignments, and leadership only from leadership_records.
--
-- REFERENCE DATA. The flow cannot run without a country, so the COUNTRY type
-- and its one item (PO decision D-N1, 2026-09-29: Việt Nam only) ship here. The
-- SPECIALIZATION items are the ones the L1 board draws; the final list is the
-- PO's (D-S1) and is managed as data (ACTIVE / ARCHIVED), not as code.
--
-- ADDITIVE ONLY. No backfill, no column or row of an existing record changes.

BEGIN;

ALTER TABLE individual_profiles
  ADD COLUMN full_name text NULL,
  ADD COLUMN phone text NULL,
  ADD COLUMN country_vocab_id uuid NULL REFERENCES vocabulary_items(id),
  ADD COLUMN capability_step_completed_at timestamptz NULL,
  ADD COLUMN role_step_completed_at timestamptz NULL,
  ADD COLUMN onboarding_hub_claims jsonb NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO vocabulary_types(code, label) VALUES
  ('COUNTRY', 'Quốc gia/Khu vực'),
  ('SPECIALIZATION', 'Chuyên môn')
ON CONFLICT (code) DO NOTHING;

-- Fixed ids, so the reference rows are the same in every environment.
INSERT INTO vocabulary_items(id, type_code, slug, label, sort_order) VALUES
  ('21000000-0000-0000-0000-000000000001', 'COUNTRY', 'vn', 'Việt Nam', 10),
  ('22000000-0000-0000-0000-000000000001', 'SPECIALIZATION', 'operations', 'Vận hành', 10),
  ('22000000-0000-0000-0000-000000000002', 'SPECIALIZATION', 'technology', 'Công nghệ', 20),
  ('22000000-0000-0000-0000-000000000003', 'SPECIALIZATION', 'finance', 'Tài chính', 30),
  ('22000000-0000-0000-0000-000000000004', 'SPECIALIZATION', 'legal', 'Luật', 40),
  ('22000000-0000-0000-0000-000000000005', 'SPECIALIZATION', 'design', 'Design', 50),
  ('22000000-0000-0000-0000-000000000006', 'SPECIALIZATION', 'marketing', 'Marketing', 60),
  ('22000000-0000-0000-0000-000000000007', 'SPECIALIZATION', 'product', 'Product', 70),
  ('22000000-0000-0000-0000-000000000008', 'SPECIALIZATION', 'business-development', 'Business Development', 80)
ON CONFLICT DO NOTHING;

CREATE TABLE profile_specializations (
  profile_id uuid NOT NULL REFERENCES individual_profiles(id) ON DELETE CASCADE,
  vocab_id uuid NOT NULL REFERENCES vocabulary_items(id),
  PRIMARY KEY (profile_id, vocab_id)
);

CREATE TABLE profile_declared_roles (
  profile_id uuid NOT NULL REFERENCES individual_profiles(id) ON DELETE CASCADE,
  role_code text NOT NULL CHECK (role_code IN (
    'HUB_MEMBER',
    'INNOVATOR',
    'STARTUP_FOUNDER',
    'ORGANIZATION_REPRESENTATIVE',
    'INVESTOR_REPRESENTATIVE',
    'INNOVATION_ENTHUSIAST'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, role_code)
);

ALTER TABLE community_memberships
  ADD COLUMN claimed_position text NULL,
  ADD COLUMN claimed_period text NULL;

COMMIT;
