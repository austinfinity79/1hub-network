-- 020_p0_team_invite_links.sql — S1-UAT-07 team invitations (Sprint 1 UAT
-- US-02.11, US-02.12; feedback FB-18; Appendix B "Lời mời": e-mail and link are
-- both P0, 7 days). PO / SA approval D1 (05/10). Decisions: DEC-S1I.
--
-- Supersedes, for the current contract, DEC-PDF-D2 ("Alpha invites by e-mail
-- only … no expiry exists"). The e-mail flow is kept; the link flow is added in
-- parallel. No existing row, column or value of another table changes, except
-- the one backfill below.
--
--   project_members.invite_expires_at   US-02.11 "Lời mời gắn với email, hết hạn
--                                        sau 7 ngày"; "Gửi lại … gia hạn 7 ngày,
--                                        không tạo bản ghi mới". The e-mail
--                                        invitation stays the PENDING_CONFIRMATION
--                                        row of migration 008; expiry is this
--                                        column, read at use (an expired row is
--                                        not accepted, not listed to its
--                                        recipient and not counted). Pending rows
--                                        that exist now get now() + 7 days, so
--                                        every invitation already sent stays valid
--                                        for the full period; other rows keep
--                                        NULL. Required while pending (CHECK).
--
--   venture_invite_links                 US-02.12 `TeamInviteLink(token,
--                                        expires_at, revoked_at)`, in this
--                                        repository's naming (`venture_*`, the
--                                        API's name for a projects row). One row
--                                        per generated link of one venture: only
--                                        the SHA-256 of the token is stored, the
--                                        token itself is never written anywhere;
--                                        `expires_at` = creation + 7 days;
--                                        `revoked_at` set when the owner
--                                        regenerates (or replaces an expired one).
--                                        At most ONE unrevoked link per venture
--                                        (partial unique index), so concurrent
--                                        regenerations cannot leave two. Joining
--                                        through a link creates an ordinary ACTIVE
--                                        project_members row (role "Thành viên",
--                                        level VIEW): no second membership model.
--
-- RE-RUN. Recorded by the runner with its sha256 and never applied twice; the
-- statements also guard themselves (IF NOT EXISTS). One transaction.
--
-- ROLLBACK (manual, never automatic; refuses while any invite link exists, so
-- no link data is lost; the expiry column is 020's own attribute — the pre-020
-- product had no expiry — so dropping it restores the pre-020 data exactly;
-- exercised by src/lib/venture/invite-link-migration.db-test.ts).
--   BEGIN;
--   DO $$ BEGIN
--     IF EXISTS (SELECT 1 FROM venture_invite_links) THEN
--       RAISE EXCEPTION '020 rollback refused: invite links exist';
--     END IF;
--   END $$;
--   DROP TABLE venture_invite_links;
--   ALTER TABLE project_members DROP CONSTRAINT ck_pm_invite_expiry;
--   ALTER TABLE project_members DROP COLUMN invite_expires_at;
--   DELETE FROM schema_migrations WHERE filename = '020_p0_team_invite_links.sql';
--   COMMIT;

BEGIN;

ALTER TABLE project_members ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz NULL;

UPDATE project_members
   SET invite_expires_at = now() + interval '7 days'
 WHERE state = 'PENDING_CONFIRMATION' AND invite_expires_at IS NULL;

ALTER TABLE project_members DROP CONSTRAINT IF EXISTS ck_pm_invite_expiry;
ALTER TABLE project_members
  ADD CONSTRAINT ck_pm_invite_expiry
  CHECK (state <> 'PENDING_CONFIRMATION' OR invite_expires_at IS NOT NULL);

CREATE TABLE IF NOT EXISTS venture_invite_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  created_by_profile_id uuid NOT NULL REFERENCES individual_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  CONSTRAINT ck_invite_link_period CHECK (expires_at > created_at),
  CONSTRAINT ck_invite_link_hash CHECK (token_hash ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_venture_invite_link_hash
  ON venture_invite_links(token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS uq_venture_invite_link_open
  ON venture_invite_links(project_id) WHERE revoked_at IS NULL;

COMMIT;
