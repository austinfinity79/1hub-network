-- 002_p0_schema_alignment.sql
--
-- Additive alignment of the P0 schema with higher-priority frozen SOT, for the
-- gaps DECISION-P0-01 classified as STALE_LOWER_PRIORITY_SCHEMA.
--
-- 001_p0_init.sql is NOT modified. Every change here is applied on top of it.
--
-- Scope, and only this scope:
--   A. RoleAssignment anchor and validity columns
--        Data SOT 1HUB_DATA_SOT_v1.1.md:297 and 03_AUTH_RBAC:53 agree on
--        individual_profile_id + valid_from + valid_to + assigned_by.
--   B. Lifecycle state domains proven by Data SOT section "lifecycle"
--        Profile     :182  NOT_CREATED -> DRAFT -> ACTIVE -> DEACTIVATED
--        Membership  :190  PENDING_APPROVAL -> ACTIVE | REJECTED | WITHDRAWN -> SUSPENDED / ALUMNI
--        Leadership  :193  ACTIVE -> ALUMNI | REVOKED
--        Event       :213  DRAFT -> PUBLISHED -> LIVE -> ENDED | CANCELLED -> ARCHIVED
--
-- Deliberately NOT in scope, because these are missing structures rather than
-- stale state domains, and each needs its own decision:
--   - EventRegistration table
--   - organizations.verification_status
--   - idempotency key store, file_assets, outbox, notification preferences
--   - seed defects B2/B4/B5, which belong to M0-T07
--
-- WHY NEW ENUM TYPES RATHER THAN ALTER TYPE ... ADD VALUE:
-- record_state is shared by organization_relationships, community_memberships,
-- leadership_records, role_assignments, membership_bootstrap and project_members;
-- publication_status is shared by organizations, programmes and events. Adding
-- LIVE to publication_status would let an Organization be LIVE, and adding
-- ALUMNI to record_state would let a project member be ALUMNI. The SOT defines
-- these lifecycles per entity, so each entity gets its own domain and the shared
-- enums are left untouched for the tables still using them.
--
-- The project runner applies each migration exactly once and records a sha256,
-- so strict re-runnability is not required; guards below are defensive only.

BEGIN;

-- ---------------------------------------------------------------- A. Roles

-- Anchor on the profile, per SOT. Added nullable first so existing rows can be
-- backfilled before the constraint is enforced.
ALTER TABLE role_assignments ADD COLUMN IF NOT EXISTS individual_profile_id uuid;

UPDATE role_assignments ra
SET individual_profile_id = p.id
FROM individual_profiles p
WHERE p.account_id = ra.account_id
  AND ra.individual_profile_id IS NULL;

-- One UserAccount maps to one root IndividualProfile (CLAUDE.md:22), so every
-- row must anchor. Fail loudly rather than drop an assignment on the floor.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM role_assignments WHERE individual_profile_id IS NULL) THEN
    RAISE EXCEPTION 'role_assignments: % row(s) have no individual_profile for their account; refusing to re-anchor',
      (SELECT count(*) FROM role_assignments WHERE individual_profile_id IS NULL);
  END IF;
END $$;

ALTER TABLE role_assignments ALTER COLUMN individual_profile_id SET NOT NULL;

ALTER TABLE role_assignments
  ADD CONSTRAINT role_assignments_profile_fk
  FOREIGN KEY (individual_profile_id) REFERENCES individual_profiles(id) ON DELETE CASCADE;

-- Validity semantics. ended_at already means "validity ended", so it is renamed
-- rather than duplicated by a second column meaning the same thing.
ALTER TABLE role_assignments RENAME COLUMN ended_at TO valid_to;

ALTER TABLE role_assignments ADD COLUMN IF NOT EXISTS valid_from timestamptz;
UPDATE role_assignments SET valid_from = created_at WHERE valid_from IS NULL;
ALTER TABLE role_assignments ALTER COLUMN valid_from SET NOT NULL;
ALTER TABLE role_assignments ALTER COLUMN valid_from SET DEFAULT now();

-- Nullable: a system-granted assignment has no human assigner.
ALTER TABLE role_assignments
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES individual_profiles(id);

-- individual_profile_id is now THE anchor: authorization resolves through it and
-- it is the column the new index serves.
--
-- account_id is kept, but demoted and made optional. Dropping it outright would
-- break db/seed/seed_dev.sql, which inserts role_assignments by account and
-- which this task is explicitly forbidden to modify. Introducing that breakage
-- would be a new incompatibility, not one of the documented B2/B4/B5 seed
-- defects. It is therefore TRANSITIONAL: M0-T07 replaces the seed with one that
-- writes individual_profile_id directly, and a later migration drops this column.
ALTER TABLE role_assignments ALTER COLUMN account_id DROP NOT NULL;

COMMENT ON COLUMN role_assignments.account_id IS
  'TRANSITIONAL. Deprecated by 002. The authoritative anchor is individual_profile_id (Data SOT :297, 03_AUTH_RBAC:53). Retained only so the frozen seed still applies; drop after M0-T07.';

-- Lets a legacy insert that supplies only account_id still satisfy the NOT NULL
-- anchor, so the frozen seed keeps working without weakening the constraint.
-- Removable together with account_id.
CREATE FUNCTION role_assignments_anchor_profile() RETURNS trigger AS $$
BEGIN
  IF NEW.individual_profile_id IS NULL AND NEW.account_id IS NOT NULL THEN
    SELECT id INTO NEW.individual_profile_id
    FROM individual_profiles
    WHERE account_id = NEW.account_id;
  END IF;

  IF NEW.individual_profile_id IS NULL THEN
    RAISE EXCEPTION 'role_assignments requires individual_profile_id, or an account_id that resolves to a profile';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER role_assignments_anchor_profile_trg
  BEFORE INSERT OR UPDATE ON role_assignments
  FOR EACH ROW EXECUTE FUNCTION role_assignments_anchor_profile();

-- The old index was named for scope but indexed only the actor and role.
-- Scoped authorization filters on scope_type and scope_id (03_AUTH_RBAC:131).
DROP INDEX IF EXISTS idx_role_actor_scope;
CREATE INDEX idx_role_profile_scope
  ON role_assignments(individual_profile_id, scope_type, scope_id, state);

-- ------------------------------------------------------------ B. Lifecycles

-- Profile: the schema's INACTIVE is the same terminal state the SOT calls
-- DEACTIVATED. A rename preserves every row and avoids two names for one state.
-- The error code PROFILE_DEACTIVATED (API 05:337) then names a storable value.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'profile_status' AND e.enumlabel = 'INACTIVE'
  ) THEN
    ALTER TYPE profile_status RENAME VALUE 'INACTIVE' TO 'DEACTIVATED';
  END IF;
END $$;

-- Event: six states, its own domain.
CREATE TYPE event_status AS ENUM ('DRAFT', 'PUBLISHED', 'LIVE', 'ENDED', 'CANCELLED', 'ARCHIVED');

ALTER TABLE events ALTER COLUMN status DROP DEFAULT;
ALTER TABLE events
  ALTER COLUMN status TYPE event_status USING status::text::event_status;
ALTER TABLE events ALTER COLUMN status SET DEFAULT 'DRAFT';

-- Membership: its own domain. CLOSED is absent because the SOT lifecycle does
-- not define it for CommunityMembership; WITHDRAWN is the SOT's terminal state.
CREATE TYPE membership_state AS ENUM (
  'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'WITHDRAWN', 'SUSPENDED', 'ALUMNI'
);

-- The partial unique index reads state, so it is dropped before the type change
-- and recreated afterwards.
DROP INDEX IF EXISTS uq_open_membership;
DROP INDEX IF EXISTS idx_membership_org_state;

ALTER TABLE community_memberships ALTER COLUMN state DROP DEFAULT;
ALTER TABLE community_memberships
  ALTER COLUMN state TYPE membership_state USING state::text::membership_state;
ALTER TABLE community_memberships ALTER COLUMN state SET DEFAULT 'PENDING_APPROVAL';

-- Restores the frozen rule that one profile has at most one open membership per
-- organization (001:203), unchanged in meaning.
CREATE UNIQUE INDEX uq_open_membership
  ON community_memberships(profile_id, organization_id)
  WHERE state IN ('PENDING_APPROVAL', 'ACTIVE');
CREATE INDEX idx_membership_org_state ON community_memberships(organization_id, state);

-- Leadership: its own domain.
CREATE TYPE leadership_state AS ENUM ('ACTIVE', 'ALUMNI', 'REVOKED');

DROP INDEX IF EXISTS idx_leadership_org_state;

ALTER TABLE leadership_records ALTER COLUMN state DROP DEFAULT;
ALTER TABLE leadership_records
  ALTER COLUMN state TYPE leadership_state USING state::text::leadership_state;
ALTER TABLE leadership_records ALTER COLUMN state SET DEFAULT 'ACTIVE';

CREATE INDEX idx_leadership_org_state ON leadership_records(organization_id, state);

COMMIT;
