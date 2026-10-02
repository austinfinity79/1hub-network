-- 016_p0_application_integrity.sql — WF05-PROD-02 persistence hardening
-- (WF05 production contract, "Submitted immutability" and DB contract D1–D3;
-- DEC-W5P-D04, D06).
--
-- No new table, column or index. Three integrity rules on the canonical
-- `applications` (migration 013), enforced in PostgreSQL so no code path, script
-- or console session can bypass them through the application role:
--
--   trg_applications_identity_fixed   an application keeps the venture, the
--                                     programme, the applicant type and the
--                                     creator it was created with, in every
--                                     status. WHY: the applicant identity is
--                                     fixed at create (DEC-W5P-D04). TODAY: only
--                                     the service refuses a change.
--   trg_applications_submitted_kept   a SUBMITTED application is never deleted;
--   trg_applications_no_truncate      TRUNCATE is refused while one exists.
--                                     WHY: submitted applications are permanent
--                                     history (DEC-W5P-D06). TODAY: 013 refuses
--                                     UPDATE only, so a DELETE drops a submitted
--                                     record without any audit trace.
--   ck_applications_snapshot_object   the submit snapshot, when present, is a
--                                     JSON object (snapshot `schema_version` 1).
--                                     TODAY: no shape check.
--
-- Unchanged: 013's `trg_applications_submitted_final` (no UPDATE of a SUBMITTED
-- row), `ck_applications_submitted`, `uq_applications_active_pair` (one active
-- application per venture and programme) and every foreign key. DRAFT rows stay
-- editable for their answers only, and stay deletable (no P0 flow deletes one;
-- test cleanup does).
--
-- EXISTING DATA. Every row is checked first and the migration STOPS, as one
-- transaction, on a snapshot that is not an object. The triggers need no data
-- check: they only govern later writes. NO DATA IS WRITTEN.
--
-- MAINTENANCE. A database superuser maintenance session may still remove rows
-- with `SET LOCAL session_replication_role = replica` (ordinary triggers do not
-- fire in that mode); the application never does, and the local / CI test
-- cleanup is the only user. Production removal of a submitted application is
-- not a P0 operation.
--
-- RE-RUN. The runner records this file in `schema_migrations` with its sha256
-- and never applies it twice; an edit after applying is refused. The file is one
-- transaction, so a failure leaves the database exactly as it was.
--
-- COMPATIBILITY. No release changes those four columns or deletes an
-- application, so the previous release (production `78f21f2`, the WF04
-- candidate) runs unchanged on this schema: an application rollback needs no
-- database rollback.
--
-- ROLLBACK (manual, never automatic; always lossless, nothing is stored;
-- exercised by src/lib/db/application-integrity.db-test.ts).
--   BEGIN;
--   DROP TRIGGER trg_applications_no_truncate ON applications;
--   DROP FUNCTION applications_refuse_truncate();
--   DROP TRIGGER trg_applications_submitted_kept ON applications;
--   DROP FUNCTION applications_refuse_submitted_delete();
--   DROP TRIGGER trg_applications_identity_fixed ON applications;
--   DROP FUNCTION applications_refuse_identity_change();
--   ALTER TABLE applications DROP CONSTRAINT ck_applications_snapshot_object;
--   DELETE FROM schema_migrations WHERE filename = '016_p0_application_integrity.sql';
--   COMMIT;

BEGIN;

-- ------------------------------------------------------- A. Existing data check

DO $$
DECLARE
  offending text;
BEGIN
  SELECT string_agg(id::text, ', ' ORDER BY id) INTO offending
    FROM applications WHERE snapshot IS NOT NULL AND jsonb_typeof(snapshot) <> 'object';
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION '016 stopped: application snapshots that are not an object: %', offending;
  END IF;
END $$;

-- --------------------------------------------------- B. Applicant identity fixed

CREATE FUNCTION applications_refuse_identity_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.venture_id IS DISTINCT FROM OLD.venture_id
     OR NEW.programme_id IS DISTINCT FROM OLD.programme_id
     OR NEW.primary_applicant_type IS DISTINCT FROM OLD.primary_applicant_type
     OR NEW.created_by_account_id IS DISTINCT FROM OLD.created_by_account_id THEN
    RAISE EXCEPTION 'an application keeps its venture, programme, applicant type and creator (DEC-W5P-D06)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_applications_identity_fixed
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION applications_refuse_identity_change();

-- ------------------------------------------- C. Submitted applications are kept

CREATE FUNCTION applications_refuse_submitted_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'SUBMITTED' THEN
    RAISE EXCEPTION 'a SUBMITTED application is never deleted (DEC-W5P-D06)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_applications_submitted_kept
  BEFORE DELETE ON applications
  FOR EACH ROW EXECUTE FUNCTION applications_refuse_submitted_delete();

CREATE FUNCTION applications_refuse_truncate() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM applications WHERE status = 'SUBMITTED') THEN
    RAISE EXCEPTION 'applications holds SUBMITTED rows, which are never deleted (DEC-W5P-D06)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_applications_no_truncate
  BEFORE TRUNCATE ON applications
  FOR EACH STATEMENT EXECUTE FUNCTION applications_refuse_truncate();

-- ---------------------------------------------------------- D. Snapshot shape

ALTER TABLE applications
  ADD CONSTRAINT ck_applications_snapshot_object
  CHECK (snapshot IS NULL OR jsonb_typeof(snapshot) = 'object');

COMMIT;
