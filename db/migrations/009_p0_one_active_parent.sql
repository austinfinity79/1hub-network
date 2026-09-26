-- 009_p0_one_active_parent.sql — WF03-S08 (DEC-WF03-G9, DEC-WF03-S08-RELATIONSHIP-CONTRACT).
--
-- P0 hierarchy invariant: a child organization has at most ONE ACTIVE PARENT
-- relationship (source = parent, target = child). Until now only the
-- application reported violations (hierarchy reader, DATA INCONSISTENCY); S08
-- adds relationship writes, so the database enforces it and two concurrent
-- parent assignments cannot both commit.
--
-- Additive only: one partial unique index. Closed rows (state CLOSED, ended_at
-- set) are history and are not covered, so history stays unlimited.
--
-- NO REPAIR: existing data that already violates the invariant is reported and
-- the migration aborts (the whole transaction rolls back) instead of guessing
-- which parent is right.

BEGIN;

DO $$
DECLARE
  violations integer;
BEGIN
  SELECT count(*) INTO violations FROM (
    SELECT target_org_id
      FROM organization_relationships
     WHERE relationship_type = 'PARENT' AND state = 'ACTIVE'
     GROUP BY target_org_id
    HAVING count(*) > 1
  ) AS children;
  IF violations > 0 THEN
    RAISE EXCEPTION
      '009_p0_one_active_parent: DATA INCONSISTENCY — % child organization(s) have more than one ACTIVE PARENT relationship. Resolve them before migrating (DEC-WF03-G9).',
      violations;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_parent_per_child
  ON organization_relationships (target_org_id)
  WHERE relationship_type = 'PARENT' AND state = 'ACTIVE';

COMMIT;
