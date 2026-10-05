-- 019_p0_profile_sprint1.sql — S1-UAT-05 WF02 profile consistency (Sprint 1
-- feedback FB-09, "Các điểm lệch khác cần dev nắm"; UAT US-01.09, US-02.02,
-- US-02.03). Decisions: DEC-S1P.
--
-- ADDITIVE ONLY. No backfill; no existing row, column or value changes.
--
--   vocab_status 'UNNORMALIZED'      FB-09: "Lĩnh vực quan tâm" and "Chuyên
--                                    môn" accept a value typed by the member;
--                                    "Giá trị tự gõ mới được lưu kèm cờ 'chưa
--                                    chuẩn hóa'" so HUB can consolidate it
--                                    later. Such a value becomes a
--                                    vocabulary_items row of the same type with
--                                    this status, so a profile still links its
--                                    domains and specialisations by vocabulary
--                                    id (CLAUDE.md section 3) and the flag IS
--                                    the item's status. Every list a member or
--                                    the Library picks from reads ACTIVE only,
--                                    so an unnormalised value never becomes a
--                                    suggestion or a filter for anyone else.
--
--   profile_experience.employment_type   "Loại hình" and "Địa điểm" of an
--   profile_experience.location          experience record: the profile board
--                                        (FP1-OWN) draws them and the edit
--                                        dialog lacked them. Both optional free
--                                        text: no source defines a list of
--                                        employment types (PO 05/10: free text),
--                                        and the place is the board's plain city
--                                        text, not the country/city catalogue of
--                                        S1-UAT-03. Existing records keep NULL.
--
-- RE-RUN. The runner records this file with its sha256 and never applies it
-- twice; `IF NOT EXISTS` also makes a manual re-apply a no-op. One transaction:
-- a failure leaves the database as it was. The new enum value is not used here.
--
-- ROLLBACK (manual, never automatic; refuses unless no row uses the new value
-- or columns, so it is lossless or does nothing; an enum value cannot be
-- dropped in place, so the type is rebuilt; exercised by
-- src/lib/profile/profile-migration.db-test.ts).
--   BEGIN;
--   DO $$ BEGIN
--     IF EXISTS (SELECT 1 FROM vocabulary_items WHERE status::text = 'UNNORMALIZED')
--        OR EXISTS (SELECT 1 FROM profile_experience
--                    WHERE employment_type IS NOT NULL OR location IS NOT NULL) THEN
--       RAISE EXCEPTION '019 rollback refused: free-text tags or experience type / place exist';
--     END IF;
--   END $$;
--   ALTER TABLE profile_experience DROP COLUMN location, DROP COLUMN employment_type;
--   ALTER TYPE vocab_status RENAME TO vocab_status_019;
--   CREATE TYPE vocab_status AS ENUM ('ACTIVE','ARCHIVED');
--   ALTER TABLE vocabulary_items ALTER COLUMN status DROP DEFAULT;
--   ALTER TABLE vocabulary_items ALTER COLUMN status TYPE vocab_status USING status::text::vocab_status;
--   ALTER TABLE vocabulary_items ALTER COLUMN status SET DEFAULT 'ACTIVE';
--   DROP TYPE vocab_status_019;
--   DELETE FROM schema_migrations WHERE filename = '019_p0_profile_sprint1.sql';
--   COMMIT;

BEGIN;

ALTER TYPE vocab_status ADD VALUE IF NOT EXISTS 'UNNORMALIZED';

ALTER TABLE profile_experience
  ADD COLUMN IF NOT EXISTS employment_type text NULL,
  ADD COLUMN IF NOT EXISTS location text NULL;

COMMIT;
