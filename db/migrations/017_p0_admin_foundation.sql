-- 017_p0_admin_foundation.sql — ADMIN-PROD-02 RBAC / scope / data foundation
-- (Admin Portal P0 contract, ADMIN-PROD-01; DEC-ADM PD-1 … PD-7, C1 … C8).
--
-- Only what the frozen contract's DB impact table names for the admin-owned
-- models. Each change, and WHY:
--
--   role_assignments.capability     PD-6 scoped delegation on the existing grant
--     + ck_role_assignments_        record (C5): null = the whole role, set = only
--       capability_scope            that capability. A capability grant is always
--                                   organization-scoped.
--   role_verification_requests      PD-1: one declared HUB position = one request
--     + verification_request_status with its own lifecycle (PENDING, APPROVED,
--     + uq_rvr_declared_position    REJECTED, WITHDRAWN) and the unit it was routed
--                                   to. `uq_open_membership` allows one open
--                                   membership per (profile, unit), so memberships
--                                   cannot hold several positions or past terms.
--   projects.website, logo_asset_id PD-3: website (http / https, the `safeUrl`
--                                   bound) and a logo in the existing media asset
--                                   store (`asset_<32 hex>`, as avatars). No
--                                   business registration / tax code column.
--   venture_reviews                 PD-2: a submitted first publish or core change
--     + venture_review_kind / status waits here; `projects` stays the approved
--     + uq_venture_reviews_pending  public version until approval. One pending
--                                   review per venture.
--   feedback_submissions            PD-5 and the contract's feedback fields: type,
--     + feedback_type / priority    route / screen / browser context, screenshot
--     + feedback_status renamed     (asset, deletion time for the 90-day rule),
--       REVIEWED → IN_REVIEW,       guest e-mail, priority, owner, resolution note,
--       CLOSED → DONE               updated_at; guests have no account. The status
--                                   enum is renamed in place: no row is rewritten.
--   account_deletion_requests       PD-7: the user's own deletion request is
--     + status / handled_by / at    processed or declined by PLATFORM_ADMIN.
--   account_action_requests         PD-7: a leader's lock / deactivate /
--     + account_action              soft-delete escalation for a member of its
--     + account_request_status      unit has no other home. One pending request
--     + uq_account_action_pending   per (account, action).
--   notifications                   contract §22: in-system notices with read
--     + notification_type           state, two producers only (verification and
--                                   venture review decisions).
--
-- Not here (no admin need, or owned elsewhere): organizations (lifecycle uses
-- `publication_status` as is), vocabulary_items (categories use label,
-- sort_order and status as is), individual_profiles.location_text (the Sprint1
-- location feature owns it, PD-4), queue / audit indexes (only with query-plan
-- evidence).
--
-- EXISTING DATA. Checked first; the migration STOPS, as one transaction, on
-- feedback text that is empty or longer than 2,000 characters (FB-01). Existing
-- rows otherwise keep every value: feedback rows get type OTHER, deletion
-- requests status PENDING. No row is deleted.
--
-- RE-RUN. The runner records this file in `schema_migrations` with its sha256
-- and never applies it twice; an edit after applying is refused. The file is one
-- transaction, so a failure leaves the database exactly as it was.
--
-- COMPATIBILITY. Additive for every reader of the previous release (production
-- `78f21f2`): new tables, nullable columns, a renamed enum no code path reads.
-- One operational rule: the previous release reads `role_assignments` without
-- `capability`, so an ACTIVE capability-only grant would read there as the whole
-- role. Before an application rollback below this release, close them:
--   UPDATE role_assignments SET state = 'CLOSED', valid_to = now()
--    WHERE capability IS NOT NULL AND state = 'ACTIVE';
-- No such grant exists until the access API ships (ADMIN-PROD-04).
--
-- ROLLBACK (manual, never automatic; refuses unless every new structure is
-- empty, so it is lossless or does nothing; exercised by
-- src/lib/admin/admin-migration.db-test.ts).
--   BEGIN;
--   DO $$ BEGIN
--     IF EXISTS (SELECT 1 FROM role_assignments WHERE capability IS NOT NULL)
--        OR EXISTS (SELECT 1 FROM role_verification_requests)
--        OR EXISTS (SELECT 1 FROM venture_reviews)
--        OR EXISTS (SELECT 1 FROM account_action_requests)
--        OR EXISTS (SELECT 1 FROM notifications)
--        OR EXISTS (SELECT 1 FROM projects WHERE website IS NOT NULL OR logo_asset_id IS NOT NULL)
--        OR EXISTS (SELECT 1 FROM feedback_submissions WHERE account_id IS NULL OR type <> 'OTHER'
--                    OR context <> '{}'::jsonb OR screenshot_asset_id IS NOT NULL
--                    OR screenshot_deleted_at IS NOT NULL OR guest_email IS NOT NULL
--                    OR priority IS NOT NULL OR assigned_owner_account_id IS NOT NULL
--                    OR resolution_note IS NOT NULL)
--        OR EXISTS (SELECT 1 FROM account_deletion_requests WHERE status <> 'PENDING') THEN
--       RAISE EXCEPTION '017 rollback refused: admin data exists';
--     END IF;
--   END $$;
--   DROP TABLE notifications;
--   DROP TYPE notification_type;
--   DROP TABLE account_action_requests;
--   DROP TYPE account_action;
--   ALTER TABLE account_deletion_requests DROP CONSTRAINT ck_account_deletion_handled,
--     DROP COLUMN handled_at, DROP COLUMN handled_by_account_id, DROP COLUMN status;
--   DROP TYPE account_request_status;
--   ALTER TABLE feedback_submissions DROP CONSTRAINT ck_feedback_body,
--     DROP CONSTRAINT ck_feedback_context_object, DROP CONSTRAINT ck_feedback_screenshot_asset,
--     DROP CONSTRAINT ck_feedback_screenshot_deleted, DROP CONSTRAINT ck_feedback_guest_email,
--     DROP COLUMN updated_at, DROP COLUMN resolution_note, DROP COLUMN assigned_owner_account_id,
--     DROP COLUMN priority, DROP COLUMN guest_email, DROP COLUMN screenshot_deleted_at,
--     DROP COLUMN screenshot_asset_id, DROP COLUMN context, DROP COLUMN type,
--     ALTER COLUMN account_id SET NOT NULL;
--   DROP TYPE feedback_priority;
--   DROP TYPE feedback_type;
--   ALTER TYPE feedback_status RENAME VALUE 'DONE' TO 'CLOSED';
--   ALTER TYPE feedback_status RENAME VALUE 'IN_REVIEW' TO 'REVIEWED';
--   DROP TABLE venture_reviews;
--   DROP TYPE venture_review_status;
--   DROP TYPE venture_review_kind;
--   ALTER TABLE projects DROP CONSTRAINT ck_projects_website, DROP CONSTRAINT ck_projects_logo_asset,
--     DROP COLUMN logo_asset_id, DROP COLUMN website;
--   DROP TABLE role_verification_requests;
--   DROP TYPE verification_request_status;
--   ALTER TABLE role_assignments DROP CONSTRAINT ck_role_assignments_capability_scope,
--     DROP COLUMN capability;
--   DELETE FROM schema_migrations WHERE filename = '017_p0_admin_foundation.sql';
--   COMMIT;

BEGIN;

-- ------------------------------------------------------- A. Existing data check

DO $$
DECLARE
  offending text;
BEGIN
  SELECT string_agg(id::text, ', ' ORDER BY id) INTO offending
    FROM feedback_submissions
   WHERE char_length(btrim(body)) = 0 OR char_length(body) > 2000;
  IF offending IS NOT NULL THEN
    RAISE EXCEPTION '017 stopped: feedback text outside 1 … 2000 characters: %', offending;
  END IF;
END $$;

-- ---------------------------------------------- B. Scoped delegation (PD-6, C5)

ALTER TABLE role_assignments ADD COLUMN capability text;

ALTER TABLE role_assignments
  ADD CONSTRAINT ck_role_assignments_capability_scope
  CHECK (capability IS NULL OR (scope_type = 'ORGANIZATION' AND scope_id IS NOT NULL));

-- ------------------------------------------------ C. Role verification (PD-1)

CREATE TYPE verification_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

CREATE TABLE role_verification_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_profile_id  uuid NOT NULL REFERENCES individual_profiles(id) ON DELETE CASCADE,
  -- The unit of the declared position; its type is the level (HUB, CHAPTER, CLB).
  organization_id       uuid NOT NULL REFERENCES organizations(id),
  position_title        text NOT NULL,
  -- Month precision (MM/YYYY): the first day of the month. No end = current term.
  period_from           date NOT NULL,
  period_to             date,
  -- The receiving unit, fixed at submission after the CLB → Chapter → HUB fallback.
  routed_to_org_id      uuid NOT NULL REFERENCES organizations(id),
  status                verification_request_status NOT NULL DEFAULT 'PENDING',
  submitted_at          timestamptz NOT NULL DEFAULT now(),
  handled_by_account_id uuid REFERENCES user_accounts(id),
  handled_at            timestamptz,
  reject_reason         text,
  -- Bumped by every edit, so a decision on a stale version is refused (409).
  version               integer NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_rvr_position_title
    CHECK (position_title = btrim(position_title) AND char_length(position_title) BETWEEN 1 AND 200),
  CONSTRAINT ck_rvr_period_month
    CHECK (extract(day FROM period_from) = 1 AND (period_to IS NULL OR extract(day FROM period_to) = 1)),
  CONSTRAINT ck_rvr_period_order CHECK (period_to IS NULL OR period_to >= period_from),
  CONSTRAINT ck_rvr_handled
    CHECK ((status IN ('APPROVED', 'REJECTED')) = (handled_at IS NOT NULL AND handled_by_account_id IS NOT NULL)),
  CONSTRAINT ck_rvr_reject_reason
    CHECK (reject_reason IS NULL OR (status = 'REJECTED' AND char_length(reject_reason) <= 500)),
  CONSTRAINT ck_rvr_version CHECK (version >= 1)
);

-- One declared position = one request: the same person, unit, title and start
-- month cannot be open twice. A REJECTED request is resubmitted, not duplicated;
-- only a WITHDRAWN one frees the position.
CREATE UNIQUE INDEX uq_rvr_declared_position
  ON role_verification_requests (requester_profile_id, organization_id, lower(position_title), period_from)
  WHERE status <> 'WITHDRAWN';

-- ---------------------------------------------- D. Venture fields (PD-3)

ALTER TABLE projects
  ADD COLUMN website text,
  ADD COLUMN logo_asset_id text;

ALTER TABLE projects
  ADD CONSTRAINT ck_projects_website
  CHECK (website IS NULL OR (char_length(website) <= 500 AND website ~* '^https?://'));

ALTER TABLE projects
  ADD CONSTRAINT ck_projects_logo_asset
  CHECK (logo_asset_id IS NULL OR logo_asset_id ~ '^asset_[0-9a-f]{32}$');

-- ---------------------------------------------- E. Venture review (PD-2)

CREATE TYPE venture_review_kind AS ENUM ('FIRST_PUBLISH', 'CORE_CHANGE');
CREATE TYPE venture_review_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

CREATE TABLE venture_reviews (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id              uuid NOT NULL REFERENCES projects(id),
  kind                    venture_review_kind NOT NULL,
  -- The proposed core fields (snapshot schema_version 1). Never read by a public path.
  proposed                jsonb NOT NULL,
  version                 integer NOT NULL DEFAULT 1,
  status                  venture_review_status NOT NULL DEFAULT 'PENDING',
  submitted_by_account_id uuid NOT NULL REFERENCES user_accounts(id),
  submitted_at            timestamptz NOT NULL DEFAULT now(),
  reviewed_by_account_id  uuid REFERENCES user_accounts(id),
  reviewed_at             timestamptz,
  reject_reason           text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_venture_reviews_proposed CHECK (jsonb_typeof(proposed) = 'object'),
  CONSTRAINT ck_venture_reviews_version CHECK (version >= 1),
  CONSTRAINT ck_venture_reviews_reviewed
    CHECK ((status IN ('APPROVED', 'REJECTED')) = (reviewed_at IS NOT NULL AND reviewed_by_account_id IS NOT NULL)),
  CONSTRAINT ck_venture_reviews_reject_reason
    CHECK (reject_reason IS NULL OR (status = 'REJECTED' AND char_length(reject_reason) <= 500))
);

CREATE UNIQUE INDEX uq_venture_reviews_pending ON venture_reviews (venture_id) WHERE status = 'PENDING';

-- ---------------------------------------------- F. Feedback (PD-5, FB-01)

ALTER TYPE feedback_status RENAME VALUE 'REVIEWED' TO 'IN_REVIEW';
ALTER TYPE feedback_status RENAME VALUE 'CLOSED' TO 'DONE';

CREATE TYPE feedback_type AS ENUM ('BUG', 'UX', 'FEATURE', 'OTHER');
CREATE TYPE feedback_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH');

ALTER TABLE feedback_submissions
  ALTER COLUMN account_id DROP NOT NULL,
  ADD COLUMN type feedback_type,
  ADD COLUMN context jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN screenshot_asset_id text,
  ADD COLUMN screenshot_deleted_at timestamptz,
  ADD COLUMN guest_email text,
  ADD COLUMN priority feedback_priority,
  ADD COLUMN assigned_owner_account_id uuid REFERENCES user_accounts(id),
  ADD COLUMN resolution_note text,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Rows from before typing existed are unclassified: OTHER is the admin bucket.
UPDATE feedback_submissions SET type = 'OTHER' WHERE type IS NULL;
ALTER TABLE feedback_submissions ALTER COLUMN type SET NOT NULL;

ALTER TABLE feedback_submissions
  ADD CONSTRAINT ck_feedback_body
    CHECK (char_length(btrim(body)) > 0 AND char_length(body) <= 2000),
  ADD CONSTRAINT ck_feedback_context_object CHECK (jsonb_typeof(context) = 'object'),
  ADD CONSTRAINT ck_feedback_screenshot_asset
    CHECK (screenshot_asset_id IS NULL OR screenshot_asset_id ~ '^asset_[0-9a-f]{32}$'),
  -- After the 90-day deletion the reference is gone and only the time remains.
  ADD CONSTRAINT ck_feedback_screenshot_deleted
    CHECK (screenshot_deleted_at IS NULL OR screenshot_asset_id IS NULL),
  -- Only a guest gives an e-mail (FB-01); a signed-in sender is its account.
  ADD CONSTRAINT ck_feedback_guest_email
    CHECK (guest_email IS NULL OR (account_id IS NULL AND char_length(guest_email) <= 254));

-- ---------------------------------------------- G. Account lifecycle (PD-7)

CREATE TYPE account_request_status AS ENUM ('PENDING', 'PROCESSED', 'DECLINED');

ALTER TABLE account_deletion_requests
  ADD COLUMN status account_request_status NOT NULL DEFAULT 'PENDING',
  ADD COLUMN handled_by_account_id uuid REFERENCES user_accounts(id),
  ADD COLUMN handled_at timestamptz;

ALTER TABLE account_deletion_requests
  ADD CONSTRAINT ck_account_deletion_handled
  CHECK ((status = 'PENDING') = (handled_at IS NULL AND handled_by_account_id IS NULL));

CREATE TYPE account_action AS ENUM ('LOCK', 'DEACTIVATE', 'SOFT_DELETE');

CREATE TABLE account_action_requests (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_account_id       uuid NOT NULL REFERENCES user_accounts(id),
  -- The unit the leader files from: the scope the escalation was authorized for.
  organization_id         uuid NOT NULL REFERENCES organizations(id),
  requested_by_account_id uuid NOT NULL REFERENCES user_accounts(id),
  action                  account_action NOT NULL,
  reason                  text,
  status                  account_request_status NOT NULL DEFAULT 'PENDING',
  handled_by_account_id   uuid REFERENCES user_accounts(id),
  handled_at              timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_account_action_reason CHECK (reason IS NULL OR char_length(reason) <= 500),
  CONSTRAINT ck_account_action_handled
    CHECK ((status = 'PENDING') = (handled_at IS NULL AND handled_by_account_id IS NULL))
);

CREATE UNIQUE INDEX uq_account_action_pending
  ON account_action_requests (target_account_id, action) WHERE status = 'PENDING';

-- ---------------------------------------------- H. Notifications (contract §22)

CREATE TYPE notification_type AS ENUM (
  'VERIFICATION_APPROVED',
  'VERIFICATION_REJECTED',
  'VENTURE_REVIEW_APPROVED',
  'VENTURE_REVIEW_REJECTED'
);

CREATE TABLE notifications (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_account_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  type                 notification_type NOT NULL,
  resource_type        text NOT NULL,
  resource_id          uuid NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  read_at              timestamptz,
  CONSTRAINT ck_notifications_resource CHECK (
    (type IN ('VERIFICATION_APPROVED', 'VERIFICATION_REJECTED') AND resource_type = 'role_verification_request')
    OR (type IN ('VENTURE_REVIEW_APPROVED', 'VENTURE_REVIEW_REJECTED') AND resource_type = 'venture_review')
  )
);

COMMIT;
