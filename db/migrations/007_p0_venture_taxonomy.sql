-- 007_p0_venture_taxonomy.sql — WF02-S05 (DEC-WF02-VENTURE-TAXONOMY-STORAGE).
--
-- Canonical REGION and DOMAIN for a Project/Startup, by vocabulary id only:
-- `projects.region_id` (nullable) and `project_domains` (zero or more, no
-- duplicate pair). Vocabulary type (REGION / DOMAIN) and ACTIVE-for-new
-- selection are enforced by the venture service, as for profile_domains.
--
-- ADDITIVE ONLY. No backfill: existing projects keep region_id NULL and no
-- domain rows.

BEGIN;

ALTER TABLE projects ADD COLUMN region_id uuid NULL REFERENCES vocabulary_items(id);

CREATE TABLE project_domains (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vocabulary_item_id uuid NOT NULL REFERENCES vocabulary_items(id),
  PRIMARY KEY (project_id, vocabulary_item_id)
);

CREATE INDEX idx_project_domains_item ON project_domains(vocabulary_item_id);

COMMIT;
