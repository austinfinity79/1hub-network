-- 015_p0_programme_production.sql — WF04-PROD-02 DB / persistence hardening
-- (WF04 production contract §3, §4, §6, §11, §20; DEC-W4P-D03, D06, D11).
--
-- Persistence foundation for the canonical Programme aggregate. No new table:
-- stages and problem statements stay child content of the aggregate
-- (`programmes.metadata`), registration stays `programme_application_forms`,
-- applications stay WF05's `applications`, events stay WF03's `events`.
--
--   programme_status        the Programme / Challenge lifecycle as its own domain
--                           (Data SOT: DRAFT → PUBLISHED → CLOSED → ARCHIVED).
--                           `publication_status` stays untouched for
--                           organizations, as 002 did for events.
--                           CLOSED is the one label this migration adds
--                           (approved for P0). ARCHIVED is NOT added by WF04: the
--                           column has accepted it since 001 through
--                           `publication_status`, so it is carried over for
--                           compatibility only. It is DEFERRED for this release
--                           (DEC-W4P-D11): no transition, API, UI or filter
--                           writes or reads it.
--   organization_id         the one canonical owning organization, NOT NULL. The
--                           foreign key of 001 already refuses an unknown owner
--                           and the deletion of an owner that still has
--                           programmes.
--   ck_programmes_dates     end >= start when both are set (contract §8, §11).
--   ck_programmes_metadata  the aggregate content is a JSON object; `journey`
--                           and `challenge` keep their documented top-level
--                           shape; `challenge` belongs to a CHALLENGE only
--                           (contract §3, §11). No cardinality rule: "a Challenge
--                           needs at least one problem" is unresolved (Q7).
--
-- EXISTING DATA. Every row is checked first and the migration STOPS, as one
-- transaction, on any row it cannot carry: an owner missing, an end before the
-- start, metadata that breaks the documented shape. Status mapping is the
-- identity on the three labels the old domain allows; there is no fallback
-- value and no coercion.
--
-- NO DATA IS WRITTEN. No fixture, seed or production row is inserted, updated
-- or deleted; WF03 and WF05 tables are not altered.
--
-- RE-RUN. The runner records this file in `schema_migrations` with its sha256
-- and never applies it twice; an edit after applying is refused. The file is one
-- transaction, so a failure leaves the database exactly as it was.
--
-- COMPATIBILITY. Runtime code compares `programmes.status` with the literal
-- 'PUBLISHED' only, so the previous release runs unchanged on this schema: an
-- application rollback needs no database rollback.
--
-- ROLLBACK (manual, never automatic; lossless only while no row is CLOSED,
-- because publication_status has no CLOSED; exercised by
-- src/lib/db/programme-persistence.db-test.ts). In production the recovery path
-- stays the deploy runbook's pre-deploy backup.
--   BEGIN;
--   DO $$ BEGIN
--     IF EXISTS (SELECT 1 FROM programmes WHERE status = 'CLOSED') THEN
--       RAISE EXCEPTION 'CLOSED programmes exist; publication_status cannot hold them';
--     END IF;
--   END $$;
--   ALTER TABLE programmes DROP CONSTRAINT ck_programmes_metadata;
--   ALTER TABLE programmes DROP CONSTRAINT ck_programmes_dates;
--   ALTER TABLE programmes ALTER COLUMN organization_id DROP NOT NULL;
--   ALTER TABLE programmes ALTER COLUMN status DROP DEFAULT;
--   ALTER TABLE programmes ALTER COLUMN status TYPE publication_status USING status::text::publication_status;
--   ALTER TABLE programmes ALTER COLUMN status SET DEFAULT 'DRAFT';
--   COMMENT ON COLUMN programmes.metadata IS NULL;
--   DROP TYPE programme_status;
--   DELETE FROM schema_migrations WHERE filename = '015_p0_programme_production.sql';
--   COMMIT;

BEGIN;

-- ------------------------------------------------------- A. Existing data check

DO $$
DECLARE
  offending text;
BEGIN
  SELECT string_agg(id::text, ', ' ORDER BY id) INTO offending
    FROM programmes WHERE organization_id IS NULL;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION '015 stopped: programmes without an owning organization: %', offending;
  END IF;

  SELECT string_agg(id::text || ' (' || status::text || ')', ', ' ORDER BY id) INTO offending
    FROM programmes WHERE status::text NOT IN ('DRAFT', 'PUBLISHED', 'ARCHIVED');
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION '015 stopped: programme status with no mapping: %', offending;
  END IF;

  SELECT string_agg(id::text, ', ' ORDER BY id) INTO offending
    FROM programmes WHERE starts_at IS NOT NULL AND ends_at IS NOT NULL AND ends_at < starts_at;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION '015 stopped: programmes ending before they start: %', offending;
  END IF;

  SELECT string_agg(id::text, ', ' ORDER BY id) INTO offending
    FROM programmes
   WHERE jsonb_typeof(metadata) <> 'object'
      OR (metadata ? 'journey' AND (jsonb_typeof(metadata -> 'journey') IS DISTINCT FROM 'object'
          OR jsonb_typeof(metadata -> 'journey' -> 'stages') IS DISTINCT FROM 'array'))
      OR (metadata ? 'challenge' AND (programme_type <> 'CHALLENGE'
          OR jsonb_typeof(metadata -> 'challenge') IS DISTINCT FROM 'object'
          OR jsonb_typeof(metadata -> 'challenge' -> 'problem_statements') IS DISTINCT FROM 'array'));
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION '015 stopped: programme metadata outside the documented shape: %', offending;
  END IF;
END $$;

-- ------------------------------------------------------------ B. Lifecycle

CREATE TYPE programme_status AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');

COMMENT ON TYPE programme_status IS
  'Programme / Challenge lifecycle (Data SOT DRAFT → PUBLISHED → CLOSED → ARCHIVED). '
  'CLOSED added by 015 (WF04-PROD-02). ARCHIVED carried over from publication_status '
  'for compatibility only: DEFERRED for this release (DEC-W4P-D11).';

ALTER TABLE programmes ALTER COLUMN status DROP DEFAULT;
-- Explicit identity mapping; a label outside it would yield NULL and fail the
-- NOT NULL column rather than be coerced.
ALTER TABLE programmes
  ALTER COLUMN status TYPE programme_status USING (
    CASE status::text
      WHEN 'DRAFT' THEN 'DRAFT'
      WHEN 'PUBLISHED' THEN 'PUBLISHED'
      WHEN 'ARCHIVED' THEN 'ARCHIVED'
    END
  )::programme_status;
ALTER TABLE programmes ALTER COLUMN status SET DEFAULT 'DRAFT';

-- ------------------------------------------------------------ C. Ownership

ALTER TABLE programmes ALTER COLUMN organization_id SET NOT NULL;

-- ------------------------------------------------------- D. Aggregate content

ALTER TABLE programmes
  ADD CONSTRAINT ck_programmes_dates CHECK (
    starts_at IS NULL OR ends_at IS NULL OR ends_at >= starts_at
  );

-- IS NOT DISTINCT FROM, not =: a missing key yields NULL, and a CHECK that
-- evaluates to NULL passes.
ALTER TABLE programmes
  ADD CONSTRAINT ck_programmes_metadata CHECK (
    jsonb_typeof(metadata) = 'object'
    AND (NOT (metadata ? 'journey') OR (
      jsonb_typeof(metadata -> 'journey') IS NOT DISTINCT FROM 'object'
      AND jsonb_typeof(metadata -> 'journey' -> 'stages') IS NOT DISTINCT FROM 'array'
    ))
    AND (NOT (metadata ? 'challenge') OR (
      programme_type = 'CHALLENGE'
      AND jsonb_typeof(metadata -> 'challenge') IS NOT DISTINCT FROM 'object'
      AND jsonb_typeof(metadata -> 'challenge' -> 'problem_statements') IS NOT DISTINCT FROM 'array'
    ))
  );

COMMENT ON COLUMN programmes.metadata IS
  'Programme aggregate content (WF04 production contract §11). '
  'journey = {schema_version: 1, stages: [{id, position, name, summary, starts_on, ends_on}]}; '
  'challenge (CHALLENGE only) = {schema_version: 1, problem_statements: [{id, title, summary}]}. '
  'Field-level validation is the programme service''s; no table holds stages or problems.';

COMMIT;
