-- 021_p0_startup_profile_v1.sql — Startup Profile v2, M3 slice (THAO-06).
-- PO decisions 07/10: DEC-THAO-SP D2 (Metrics v1), D3 (Updates v1), D4 (Follow v1).
-- Additive only: no existing table, column, row or value changes.
--
--   VENTURE_METRIC          a governed vocabulary type (the metric catalogue).
--                           Items carry their unit in metadata (`count`, `vnd`).
--                           Admins relabel, reorder and archive them through the
--                           existing categories policy; no item is created at
--                           runtime (D2). Fixed ids (26000000-…), as for
--                           VENTURE_STAGE (011); 24000000-… belongs to the
--                           Sprint 1 catalogue seed.
--
--   venture_metrics         one row per (venture, metric) the venture reports:
--                           its visibility, PUBLIC or PRIVATE only (no investor
--                           tier). Changing the visibility is the only update.
--
--   venture_metric_values   the quarterly values, APPEND-ONLY: a correction is a
--                           new row for the same quarter; the latest row of a
--                           quarter is current, the older rows are its history.
--                           A trigger refuses UPDATE. Source is MANUAL only.
--
--   venture_updates         manual plain-text posts (D3). Edits update the row
--                           (`updated_at`); delete is soft (`deleted_at`).
--                           Visibility is the venture's own, so none is stored.
--
--   venture_follows         follower account → startup (D4); one row per pair;
--                           unfollow deletes the row. No count is stored.
--
-- Every write is audited by the application (audit_events). No notification
-- type is added (D3, D4).
--
-- RE-RUN. Recorded by the runner with its sha256 and never applied twice; the
-- statements also guard themselves. One transaction.
--
-- ROLLBACK (manual, never automatic; refuses while any M3 data exists, so no
-- owner-entered data is lost; exercised by src/lib/profile/profile-migration.db-test.ts).
--   BEGIN;
--   DO $$ BEGIN
--     IF EXISTS (SELECT 1 FROM venture_metric_values) OR EXISTS (SELECT 1 FROM venture_updates)
--        OR EXISTS (SELECT 1 FROM venture_follows) THEN
--       RAISE EXCEPTION '021 rollback refused: startup profile data exists';
--     END IF;
--   END $$;
--   DROP TABLE venture_follows;
--   DROP TABLE venture_updates;
--   DROP TABLE venture_metric_values;
--   DROP FUNCTION venture_metric_values_append_only();
--   DROP TABLE venture_metrics;
--   DELETE FROM vocabulary_items WHERE type_code = 'VENTURE_METRIC';
--   DELETE FROM vocabulary_types WHERE code = 'VENTURE_METRIC';
--   DELETE FROM schema_migrations WHERE filename = '021_p0_startup_profile_v1.sql';
--   COMMIT;

BEGIN;

-- ------------------------------------------------------- A. Metric catalogue

INSERT INTO vocabulary_types(code, label) VALUES
  ('VENTURE_METRIC', 'Chỉ số sản phẩm')
ON CONFLICT (code) DO NOTHING;

INSERT INTO vocabulary_items(id, type_code, slug, label, sort_order, metadata) VALUES
  ('26000000-0000-0000-0000-000000000001', 'VENTURE_METRIC', 'customers', 'Khách hàng', 10, '{"unit": "count"}'),
  ('26000000-0000-0000-0000-000000000002', 'VENTURE_METRIC', 'active-users', 'Người dùng hoạt động', 20, '{"unit": "count"}'),
  ('26000000-0000-0000-0000-000000000003', 'VENTURE_METRIC', 'pilots', 'Dự án thí điểm', 30, '{"unit": "count"}'),
  ('26000000-0000-0000-0000-000000000004', 'VENTURE_METRIC', 'team-size', 'Quy mô đội ngũ', 40, '{"unit": "count"}'),
  ('26000000-0000-0000-0000-000000000005', 'VENTURE_METRIC', 'revenue', 'Doanh thu', 50, '{"unit": "vnd"}')
ON CONFLICT DO NOTHING;

-- An id taken by another row would skip an item silently: stop instead.
DO $$ BEGIN
  IF (SELECT count(*) FROM vocabulary_items WHERE type_code = 'VENTURE_METRIC') <> 5 THEN
    RAISE EXCEPTION '021 stopped: the VENTURE_METRIC catalogue is incomplete';
  END IF;
END $$;

-- ------------------------------------------------------- B. Metrics

CREATE TABLE IF NOT EXISTS venture_metrics (
  venture_id            uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  metric_id             uuid NOT NULL REFERENCES vocabulary_items(id),
  visibility            visibility_level NOT NULL DEFAULT 'PRIVATE',
  created_by_account_id uuid NOT NULL REFERENCES user_accounts(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (venture_id, metric_id),
  CONSTRAINT ck_venture_metrics_visibility CHECK (visibility IN ('PUBLIC', 'PRIVATE'))
);

CREATE TABLE IF NOT EXISTS venture_metric_values (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id            uuid NOT NULL,
  metric_id             uuid NOT NULL,
  period_year           smallint NOT NULL,
  period_quarter        smallint NOT NULL,
  value                 numeric(20, 2) NOT NULL,
  source                text NOT NULL DEFAULT 'MANUAL',
  created_by_account_id uuid NOT NULL REFERENCES user_accounts(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (venture_id, metric_id) REFERENCES venture_metrics(venture_id, metric_id) ON DELETE CASCADE,
  CONSTRAINT ck_vmv_quarter CHECK (period_quarter BETWEEN 1 AND 4),
  CONSTRAINT ck_vmv_year CHECK (period_year BETWEEN 2000 AND 2100),
  CONSTRAINT ck_vmv_value CHECK (value >= 0),
  CONSTRAINT ck_vmv_source CHECK (source = 'MANUAL')
);
CREATE INDEX IF NOT EXISTS idx_vmv_series
  ON venture_metric_values(venture_id, metric_id, period_year DESC, period_quarter DESC, created_at DESC);

CREATE OR REPLACE FUNCTION venture_metric_values_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'venture_metric_values is append-only (DEC-THAO-SP-D2)';
END $$;

DROP TRIGGER IF EXISTS tg_vmv_append_only ON venture_metric_values;
CREATE TRIGGER tg_vmv_append_only BEFORE UPDATE ON venture_metric_values
  FOR EACH ROW EXECUTE FUNCTION venture_metric_values_append_only();

-- ------------------------------------------------------- C. Updates

CREATE TABLE IF NOT EXISTS venture_updates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id            uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_account_id     uuid NOT NULL REFERENCES user_accounts(id),
  body                  text NOT NULL,
  published_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz,
  deleted_by_account_id uuid REFERENCES user_accounts(id),
  CONSTRAINT ck_venture_updates_body CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  CONSTRAINT ck_venture_updates_deleted CHECK ((deleted_at IS NULL) = (deleted_by_account_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_venture_updates_feed
  ON venture_updates(venture_id, published_at DESC) WHERE deleted_at IS NULL;

-- ------------------------------------------------------- D. Follow

CREATE TABLE IF NOT EXISTS venture_follows (
  follower_account_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  venture_id          uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_account_id, venture_id)
);

COMMIT;
