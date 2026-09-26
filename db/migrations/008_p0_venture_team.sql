-- 008_p0_venture_team.sql — WF02-S06 (P12; DEC-WF02-S06-G1, G6, G9).
--
-- Canonical venture team on the existing `project_members`: one row is either a
-- pending email invitation or a profile membership, with the SOT lifecycle
-- PENDING_CONFIRMATION -> ACTIVE -> LEFT | REMOVED | REJECTED in a dedicated
-- enum (record_state stays untouched for the other tables that use it). The
-- owner is `projects.owner_profile_id` only and never gets a row here.
--
-- NO INFERENCE (G9): the only pre-008 state that converts deterministically is
-- an open ACTIVE membership. Any other row (for example a profile-bound
-- PENDING_APPROVAL) has no provable team meaning, so the migration aborts
-- instead of guessing, and the whole transaction rolls back.

BEGIN;

DO $$
DECLARE
  unsupported integer;
BEGIN
  SELECT count(*) INTO unsupported
    FROM project_members
   WHERE state::text <> 'ACTIVE' OR ended_at IS NOT NULL;
  IF unsupported > 0 THEN
    RAISE EXCEPTION
      '008_p0_venture_team: % project_members row(s) are not open ACTIVE memberships; their team lifecycle meaning cannot be derived. Remediate them before migrating (DEC-WF02-S06-G9).',
      unsupported;
  END IF;
END $$;

CREATE TYPE team_membership_state AS ENUM
  ('PENDING_CONFIRMATION', 'ACTIVE', 'LEFT', 'REMOVED', 'REJECTED');

-- The partial index predicate references the old type, so it is rebuilt.
DROP INDEX uq_open_project_member;
ALTER TABLE project_members ALTER COLUMN state DROP DEFAULT;
ALTER TABLE project_members
  ALTER COLUMN state TYPE team_membership_state USING state::text::team_membership_state;
ALTER TABLE project_members ALTER COLUMN state SET DEFAULT 'ACTIVE';

ALTER TABLE project_members ALTER COLUMN profile_id DROP NOT NULL;
ALTER TABLE project_members ALTER COLUMN joined_at DROP NOT NULL;

ALTER TABLE project_members
  ADD COLUMN invite_email_normalized text NULL,
  ADD COLUMN invited_by_profile_id uuid NULL REFERENCES individual_profiles(id),
  ADD COLUMN invited_at timestamptz NULL,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- One CHECK per lifecycle state, so each canonical shape is explicit.
ALTER TABLE project_members
  ADD CONSTRAINT ck_pm_pending CHECK (state <> 'PENDING_CONFIRMATION' OR (
    profile_id IS NULL AND invite_email_normalized IS NOT NULL AND joined_at IS NULL
    AND ended_at IS NULL AND invited_at IS NOT NULL AND invited_by_profile_id IS NOT NULL)),
  ADD CONSTRAINT ck_pm_active CHECK (state <> 'ACTIVE' OR (
    profile_id IS NOT NULL AND invite_email_normalized IS NULL AND joined_at IS NOT NULL
    AND ended_at IS NULL)),
  ADD CONSTRAINT ck_pm_left CHECK (state <> 'LEFT' OR (
    profile_id IS NOT NULL AND invite_email_normalized IS NULL AND joined_at IS NOT NULL
    AND ended_at IS NOT NULL)),
  -- REMOVED keeps the source row's shape: a removed member or a cancelled invitation.
  ADD CONSTRAINT ck_pm_removed CHECK (state <> 'REMOVED' OR (ended_at IS NOT NULL AND (
    (profile_id IS NOT NULL AND invite_email_normalized IS NULL AND joined_at IS NOT NULL)
    OR (profile_id IS NULL AND invite_email_normalized IS NOT NULL AND joined_at IS NULL
        AND invited_at IS NOT NULL)))),
  -- REJECTED is a recipient-declined invitation; no membership ever existed.
  ADD CONSTRAINT ck_pm_rejected CHECK (state <> 'REJECTED' OR (
    profile_id IS NULL AND invite_email_normalized IS NOT NULL AND joined_at IS NULL
    AND ended_at IS NOT NULL AND invited_at IS NOT NULL)),
  ADD CONSTRAINT ck_pm_email_normalized CHECK (
    invite_email_normalized IS NULL OR invite_email_normalized = lower(btrim(invite_email_normalized)));

CREATE UNIQUE INDEX uq_open_project_member
  ON project_members(project_id, profile_id) WHERE state = 'ACTIVE';
CREATE UNIQUE INDEX uq_pending_project_invitation
  ON project_members(project_id, invite_email_normalized) WHERE state = 'PENDING_CONFIRMATION';
CREATE INDEX idx_project_members_pending_email
  ON project_members(invite_email_normalized) WHERE state = 'PENDING_CONFIRMATION';

COMMIT;
