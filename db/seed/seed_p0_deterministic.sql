-- seed_p0_deterministic.sql
--
-- Deterministic, idempotent P0 development/QA fixtures. Supersedes
-- db/seed/seed_dev.sql, which stays on disk byte-identical as frozen evidence.
--
-- WHY A NEW FILE: seed_dev.sql contradicts its own README. SEED_README.md:6
-- promises "Fixed UUIDs in dev seed exist so Playwright/pixel QA gets stable
-- URLs and states", but that file calls now() in five inserts, omits ids on four
-- tables and lacks ON CONFLICT on two. Measured in M0-T06A: a second run took
-- leadership_records 1 -> 2 and role_assignments 2 -> 4, and ids changed across
-- resets. The frozen file is not edited; this one replaces its role.
--
-- DETERMINISM: every row carries an explicit UUID and every timestamp is a
-- literal. Nothing calls now() or gen_random_uuid().
--
-- IDEMPOTENCY: every insert is ON CONFLICT (primary key) DO UPDATE, so a second
-- run converges to the same state instead of duplicating. No schema change was
-- needed to achieve this.
--
-- ROLE CODES: only the frozen catalogue (1HUB_DATA_SOT_v1.1.md:316), restricted
-- to the four the Auth/RBAC doc marks P0-active (03_AUTH_RBAC:80-83). The
-- invented ORG_ADMIN and PLATFORM_OPS from the old seed are gone:
-- ORG_ADMIN -> HUB_COMMUNITY_LEADER, PLATFORM_OPS -> PLATFORM_ADMIN.
--
-- ROLE ANCHOR: role_assignments are written through individual_profile_id only.
-- account_id is left NULL deliberately, which demonstrates that the transitional
-- column and trigger migration 002 had to keep are no longer needed by the seed.
--
-- PROFILE COMPLETION: the ten groups are the frozen list from
-- 00_DATA_DECISIONS_FREEZE_v1.1.md:98-107, as settled by DECISION-P0-01.
-- NETWORK_CONTEXT is NOT a group, and membership never affects completion.
--
-- NOT REAL DATA: organisation names are generic placeholders. Production roster
-- import stays separate, via production_roster_template.csv (SEED_README.md:4).

BEGIN;

-- ------------------------------------------------------- controlled vocabulary

INSERT INTO vocabulary_types(code, label, created_at) VALUES
  ('REGION', 'Khu vực',        '2026-01-15T09:00:00Z'),
  ('DOMAIN', 'Lĩnh vực',       '2026-01-15T09:00:00Z'),
  ('SKILL',  'Kỹ năng',        '2026-01-15T09:00:00Z')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label;

-- Three regions so the vocabulary search (?q=) has something to filter.
INSERT INTO vocabulary_items(id, type_code, slug, label, sort_order, status, metadata, created_at, updated_at) VALUES
  ('20000000-0000-0000-0000-000000000001', 'REGION', 'hanoi',      'Hà Nội',         1, 'ACTIVE', '{}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('20000000-0000-0000-0000-000000000002', 'REGION', 'da-nang',    'Đà Nẵng',        2, 'ACTIVE', '{}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('20000000-0000-0000-0000-000000000003', 'REGION', 'ho-chi-minh','TP. Hồ Chí Minh',3, 'ACTIVE', '{}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('20000000-0000-0000-0000-000000000011', 'DOMAIN', 'govtech',    'Công nghệ khu vực công', 1, 'ACTIVE', '{}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('20000000-0000-0000-0000-000000000012', 'DOMAIN', 'edtech',     'Giáo dục',       2, 'ACTIVE', '{}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('20000000-0000-0000-0000-000000000021', 'SKILL',  'product',    'Sản phẩm',       1, 'ACTIVE', '{}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('20000000-0000-0000-0000-000000000022', 'SKILL',  'engineering','Kỹ thuật',       2, 'ACTIVE', '{}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug, label = EXCLUDED.label, sort_order = EXCLUDED.sort_order,
  status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;

-- --------------------------------------------------------------- legal documents

INSERT INTO legal_documents(id, document_type, version, title, content_uri, effective_at, created_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'TERMS_ACCEPTANCE',        'p0-2026-09', 'Điều khoản sử dụng',   '/legal/terms/p0-2026-09',   '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('a0000000-0000-0000-0000-000000000002', 'PRIVACY_DATA_PROCESSING', 'p0-2026-09', 'Chính sách quyền riêng tư', '/legal/privacy/p0-2026-09', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  version = EXCLUDED.version, title = EXCLUDED.title, content_uri = EXCLUDED.content_uri;

-- ---------------------------------------------------------------- organisations
-- Generic placeholders. Real HUB/Chapter/CLB names are never invented here.

INSERT INTO organizations(id, type, parent_id, slug, name, description, status, metadata, created_at, updated_at) VALUES
  ('10000000-0000-0000-0000-000000000001', 'HUB',     NULL,                                   'hub-network', 'HUB Network',       'Fixture HUB',     'PUBLISHED', '{}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('10000000-0000-0000-0000-000000000101', 'CHAPTER', '10000000-0000-0000-0000-000000000001', 'chapter-01',  'Chapter 01',        'Fixture chapter', 'PUBLISHED', '{}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('10000000-0000-0000-0000-000000000102', 'CHAPTER', '10000000-0000-0000-0000-000000000001', 'chapter-02',  'Chapter 02',        'Fixture chapter with no members, for cross-scope denial tests', 'PUBLISHED', '{}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('10000000-0000-0000-0000-000000000103', 'CLB',     '10000000-0000-0000-0000-000000000101', 'club-01',     'Club 01',           'Fixture club',    'PUBLISHED', '{}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  type = EXCLUDED.type, parent_id = EXCLUDED.parent_id, slug = EXCLUDED.slug,
  name = EXCLUDED.name, description = EXCLUDED.description, status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;

-- WF03-S08 needs relationship history to render.
INSERT INTO organization_relationships(id, source_org_id, target_org_id, relationship_type, state, started_at, metadata, created_at) VALUES
  ('d0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000101', 'PARENT', 'ACTIVE', '2026-01-15T09:00:00Z', '{}', '2026-01-15T09:00:00Z'),
  ('d0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000103', 'PARENT', 'ACTIVE', '2026-01-15T09:00:00Z', '{}', '2026-01-15T09:00:00Z'),
  -- DEC-WF03-C2: the canonical PARENT row the fixture's legacy parent_id already
  -- implied (HUB -> Chapter 02). Fixture only; runtime never reads parent_id.
  ('d0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000102', 'PARENT', 'ACTIVE', '2026-01-15T09:00:00Z', '{}', '2026-01-15T09:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  relationship_type = EXCLUDED.relationship_type, state = EXCLUDED.state;

-- -------------------------------------------------------------------- accounts

INSERT INTO user_accounts(id, email, email_normalized, status, created_at, updated_at) VALUES
  ('30000000-0000-0000-0000-000000000001', 'member@example.test',   'member@example.test',   'ACTIVE', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('30000000-0000-0000-0000-000000000002', 'leader@example.test',   'leader@example.test',   'ACTIVE', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('30000000-0000-0000-0000-000000000003', 'ops@example.test',      'ops@example.test',      'ACTIVE', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('30000000-0000-0000-0000-000000000004', 'newcomer@example.test', 'newcomer@example.test', 'ACTIVE', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('30000000-0000-0000-0000-000000000005', 'pending@example.test',  'pending@example.test',  'ACTIVE', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email, email_normalized = EXCLUDED.email_normalized,
  status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;

-- -------------------------------------------------------------------- profiles
-- Completion groups per 00_DATA_DECISIONS_FREEZE_v1.1.md:98-107:
--   1 display_name  2 avatar_asset_id  3 headline  4 region_vocab_id  5 bio
--   6 domain  7 skills  8 experience (or no_experience_yet)  9 development_goal
--   10 current_need
-- Member reaches 10/10 = 100%; Pending sits at 6/10 = 60%, deliberately below
-- the 80% KPI so both sides of that boundary are testable; Newcomer is a DRAFT
-- pre-onboarding profile at 1/10.

INSERT INTO individual_profiles(id, account_id, status, display_name, avatar_asset_id, headline, region_vocab_id, bio, development_goal, current_need, no_experience_yet, primary_intent, onboarding_completed_at, created_at, updated_at) VALUES
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'ACTIVE', 'Demo Member', 'asset_demo_member_avatar', 'Product Manager', '20000000-0000-0000-0000-000000000001', 'Fixture member profile at full completion.', 'Dẫn dắt một sản phẩm khu vực công.', 'Tìm cố vấn sản phẩm.', false, 'EXPLORE_NETWORK', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'ACTIVE', 'Demo Leader', 'asset_demo_leader_avatar', 'Chapter Leader',  '20000000-0000-0000-0000-000000000002', 'Fixture chapter leader.',                  'Xây dựng cộng đồng chapter.', 'Tìm đối tác tổ chức sự kiện.', false, 'EXPLORE_NETWORK', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'ACTIVE', 'Demo Ops',    'asset_demo_ops_avatar',    'Platform Admin',  '20000000-0000-0000-0000-000000000001', 'Fixture platform administrator.',          'Vận hành nền tảng.',          'Không.',                       true,  'EXPLORE_NETWORK', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', 'DRAFT',  'Demo Newcomer', NULL,                     NULL,              NULL,                                   NULL,                                       NULL,                          NULL,                           false, NULL,              NULL,                   '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', 'ACTIVE', 'Demo Pending', NULL,                      'Researcher',      '20000000-0000-0000-0000-000000000003', NULL,                                       'Tham gia một chapter.',       NULL,                           false, 'EXPLORE_NETWORK', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status, display_name = EXCLUDED.display_name,
  avatar_asset_id = EXCLUDED.avatar_asset_id, headline = EXCLUDED.headline,
  region_vocab_id = EXCLUDED.region_vocab_id, bio = EXCLUDED.bio,
  development_goal = EXCLUDED.development_goal, current_need = EXCLUDED.current_need,
  no_experience_yet = EXCLUDED.no_experience_yet, primary_intent = EXCLUDED.primary_intent,
  onboarding_completed_at = EXCLUDED.onboarding_completed_at, updated_at = EXCLUDED.updated_at,
  -- Migration 005: fixture personas start with the Purpose step not recorded
  -- (completed personas resolve as DONE through onboarding_completed_at).
  purpose_step_completed_at = NULL;

INSERT INTO profile_domains(profile_id, vocab_id) VALUES
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000011'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000011'),
  ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000012'),
  ('40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000012')
ON CONFLICT (profile_id, vocab_id) DO NOTHING;

INSERT INTO profile_skills(profile_id, vocab_id) VALUES
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000021'),
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000022'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000021'),
  ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000022'),
  ('40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000021')
ON CONFLICT (profile_id, vocab_id) DO NOTHING;

-- Completion group 8. Ops uses no_experience_yet instead, which the frozen rule
-- accepts as an explicit alternative.
INSERT INTO profile_experience(id, profile_id, title, organization_name, started_on, ended_on, description, sort_order, created_at, updated_at) VALUES
  ('f0000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Product Manager', 'Fixture Company', '2024-01-01', NULL, 'Fixture experience entry.', 1, '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('f0000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'Chapter Leader',  'HUB Network',     '2025-06-01', NULL, 'Fixture leadership experience.', 1, '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, organization_name = EXCLUDED.organization_name,
  description = EXCLUDED.description, updated_at = EXCLUDED.updated_at;

INSERT INTO profile_visibility_settings(profile_id, default_level, group_overrides, updated_at) VALUES
  ('40000000-0000-0000-0000-000000000001', 'NETWORK_ONLY', '{}', '2026-01-15T09:00:00Z'),
  ('40000000-0000-0000-0000-000000000002', 'NETWORK_ONLY', '{}', '2026-01-15T09:00:00Z'),
  ('40000000-0000-0000-0000-000000000003', 'PRIVATE',      '{}', '2026-01-15T09:00:00Z'),
  ('40000000-0000-0000-0000-000000000004', 'PRIVATE',      '{}', '2026-01-15T09:00:00Z'),
  ('40000000-0000-0000-0000-000000000005', 'PUBLIC',       '{}', '2026-01-15T09:00:00Z')
ON CONFLICT (profile_id) DO UPDATE SET
  default_level = EXCLUDED.default_level, group_overrides = EXCLUDED.group_overrides,
  updated_at = EXCLUDED.updated_at;

-- -------------------------------------------------------------------- consent
-- WF01-S07. Newcomer has none, which is the pre-onboarding state that screen
-- must be able to render.

INSERT INTO consent_records(id, account_id, consent_type, legal_document_id, accepted_at, metadata, created_at) VALUES
  ('90000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'TERMS_ACCEPTANCE',        'a0000000-0000-0000-0000-000000000001', '2026-01-15T09:00:00Z', '{}', '2026-01-15T09:00:00Z'),
  ('90000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'PRIVACY_DATA_PROCESSING', 'a0000000-0000-0000-0000-000000000002', '2026-01-15T09:00:00Z', '{}', '2026-01-15T09:00:00Z'),
  ('90000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'TERMS_ACCEPTANCE',        'a0000000-0000-0000-0000-000000000001', '2026-01-15T09:00:00Z', '{}', '2026-01-15T09:00:00Z'),
  ('90000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 'PRIVACY_DATA_PROCESSING', 'a0000000-0000-0000-0000-000000000002', '2026-01-15T09:00:00Z', '{}', '2026-01-15T09:00:00Z'),
  ('90000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000003', 'TERMS_ACCEPTANCE',        'a0000000-0000-0000-0000-000000000001', '2026-01-15T09:00:00Z', '{}', '2026-01-15T09:00:00Z'),
  ('90000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000003', 'PRIVACY_DATA_PROCESSING', 'a0000000-0000-0000-0000-000000000002', '2026-01-15T09:00:00Z', '{}', '2026-01-15T09:00:00Z'),
  ('90000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000005', 'TERMS_ACCEPTANCE',        'a0000000-0000-0000-0000-000000000001', '2026-01-15T09:00:00Z', '{}', '2026-01-15T09:00:00Z'),
  ('90000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000005', 'PRIVACY_DATA_PROCESSING', 'a0000000-0000-0000-0000-000000000002', '2026-01-15T09:00:00Z', '{}', '2026-01-15T09:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  accepted_at = EXCLUDED.accepted_at, withdrawn_at = NULL;

-- ------------------------------------------------------- preseed + memberships
-- The D2 primary path (00_DATA_DECISIONS_FREEZE_v1.1.md:57): a known roster is
-- imported, an exact email match consumes it, and membership becomes ACTIVE.
-- The unconsumed row lets the claim path be exercised end to end.

INSERT INTO membership_bootstrap(id, email_normalized, organization_id, membership_state, leadership_role_label, consumed_by_account_id, consumed_at, source_batch, created_at) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'member@example.test',    '10000000-0000-0000-0000-000000000101', 'ACTIVE', NULL,             '30000000-0000-0000-0000-000000000001', '2026-01-15T09:00:00Z', 'fixture-batch-01', '2026-01-15T09:00:00Z'),
  ('e0000000-0000-0000-0000-000000000002', 'leader@example.test',    '10000000-0000-0000-0000-000000000101', 'ACTIVE', 'Chapter Leader', '30000000-0000-0000-0000-000000000002', '2026-01-15T09:00:00Z', 'fixture-batch-01', '2026-01-15T09:00:00Z'),
  ('e0000000-0000-0000-0000-000000000003', 'unclaimed@example.test', '10000000-0000-0000-0000-000000000102', 'ACTIVE', NULL,             NULL,                                   NULL,                   'fixture-batch-01', '2026-01-15T09:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  membership_state = EXCLUDED.membership_state,
  leadership_role_label = EXCLUDED.leadership_role_label,
  consumed_by_account_id = EXCLUDED.consumed_by_account_id,
  consumed_at = EXCLUDED.consumed_at;

-- ACTIVE from preseed; PENDING_APPROVAL from self-selection. The frozen rule
-- (FREEZE:71) is that self-selection never auto-activates, and FREEZE:76
-- requires the pending state to be renderable.
INSERT INTO community_memberships(id, profile_id, organization_id, state, source, started_at, created_at, updated_at) VALUES
  ('60000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000101', 'ACTIVE',           'ORGANIZATION_VERIFIED', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('60000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000101', 'ACTIVE',           'ORGANIZATION_VERIFIED', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('60000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000101', 'PENDING_APPROVAL', 'SELF_DECLARED',         NULL,                   '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  state = EXCLUDED.state, source = EXCLUDED.source,
  started_at = EXCLUDED.started_at, updated_at = EXCLUDED.updated_at;

INSERT INTO leadership_records(id, profile_id, organization_id, role_label, state, started_at, created_at) VALUES
  ('70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000101', 'Chapter Leader', 'ACTIVE', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  role_label = EXCLUDED.role_label, state = EXCLUDED.state, started_at = EXCLUDED.started_at;

-- ------------------------------------------------------------ role assignments
-- Only frozen catalogue codes, P0-active subset. account_id is intentionally
-- left NULL: the anchor is individual_profile_id.

INSERT INTO role_assignments(id, individual_profile_id, role_code, scope_type, scope_id, state, valid_from, created_at) VALUES
  ('80000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'INDIVIDUAL_USER',      'PLATFORM',     NULL,                                   'ACTIVE', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('80000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'HUB_MEMBER',           'ORGANIZATION', '10000000-0000-0000-0000-000000000101', 'ACTIVE', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('80000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 'INDIVIDUAL_USER',      'PLATFORM',     NULL,                                   'ACTIVE', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('80000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', 'HUB_COMMUNITY_LEADER', 'ORGANIZATION', '10000000-0000-0000-0000-000000000101', 'ACTIVE', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('80000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000003', 'PLATFORM_ADMIN',       'PLATFORM',     NULL,                                   'ACTIVE', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('80000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000005', 'INDIVIDUAL_USER',      'PLATFORM',     NULL,                                   'ACTIVE', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  individual_profile_id = EXCLUDED.individual_profile_id, role_code = EXCLUDED.role_code,
  scope_type = EXCLUDED.scope_type, scope_id = EXCLUDED.scope_id,
  state = EXCLUDED.state, valid_from = EXCLUDED.valid_from,
  -- A reseed converges: a test that expired or ended an assignment is undone.
  valid_to = EXCLUDED.valid_to;

-- --------------------------------------------------------------- WF02 ventures

INSERT INTO projects(id, type, owner_profile_id, slug, name, summary, status, metadata, created_at, updated_at) VALUES
  ('50000000-0000-0000-0000-000000000001', 'STARTUP', '40000000-0000-0000-0000-000000000001', 'demo-startup', 'Demo Startup', 'Fixture startup profile.', 'ACTIVE', '{}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  type = EXCLUDED.type, owner_profile_id = EXCLUDED.owner_profile_id, slug = EXCLUDED.slug,
  name = EXCLUDED.name, summary = EXCLUDED.summary, status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;

-- Team (DEC-WF02-S06-G1, G5, G9). The owner is projects.owner_profile_id only,
-- so the legacy owner 'Founder' member row is gone (deleted by id so a reseed
-- converges). The legacy profile-bound PENDING_APPROVAL row is replaced by a
-- canonical pending email invitation for the Demo Leader account; it stays
-- unlinked (profile_id NULL) until that account explicitly accepts (G2).
DELETE FROM project_members WHERE id = '11000000-0000-0000-0000-000000000001';

-- S1-UAT-07 (migration 020): a pending invitation carries its expiry. The
-- fixture keeps a fixed, far one so the deterministic invitation stays open;
-- the 7-day rule is applied by the services that write real invitations. The
-- seed also runs on schemas before 020 (the migration upgrade tests), where the
-- column does not exist yet and 020's own backfill gives the row its expiry.
DO $seed$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'project_members' AND column_name = 'invite_expires_at') THEN
    EXECUTE $q$
      INSERT INTO project_members(id, project_id, profile_id, role_label, state, joined_at, invite_email_normalized, invited_by_profile_id, invited_at, invite_expires_at, updated_at) VALUES
        ('11000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', NULL, 'Contributor', 'PENDING_CONFIRMATION', NULL, 'leader@example.test', '40000000-0000-0000-0000-000000000001', '2026-01-15T09:00:00Z', '2099-12-31T00:00:00Z', '2026-01-15T09:00:00Z')
      ON CONFLICT (id) DO UPDATE SET
        project_id = EXCLUDED.project_id, profile_id = EXCLUDED.profile_id,
        role_label = EXCLUDED.role_label, state = EXCLUDED.state, joined_at = EXCLUDED.joined_at,
        ended_at = NULL, invite_email_normalized = EXCLUDED.invite_email_normalized,
        invited_by_profile_id = EXCLUDED.invited_by_profile_id,
        invited_at = EXCLUDED.invited_at, invite_expires_at = EXCLUDED.invite_expires_at,
        updated_at = EXCLUDED.updated_at
    $q$;
  ELSE
    EXECUTE $q$
      INSERT INTO project_members(id, project_id, profile_id, role_label, state, joined_at, invite_email_normalized, invited_by_profile_id, invited_at, updated_at) VALUES
        ('11000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', NULL, 'Contributor', 'PENDING_CONFIRMATION', NULL, 'leader@example.test', '40000000-0000-0000-0000-000000000001', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z')
      ON CONFLICT (id) DO UPDATE SET
        project_id = EXCLUDED.project_id, profile_id = EXCLUDED.profile_id,
        role_label = EXCLUDED.role_label, state = EXCLUDED.state, joined_at = EXCLUDED.joined_at,
        ended_at = NULL, invite_email_normalized = EXCLUDED.invite_email_normalized,
        invited_by_profile_id = EXCLUDED.invited_by_profile_id,
        invited_at = EXCLUDED.invited_at, updated_at = EXCLUDED.updated_at
    $q$;
  END IF;
END
$seed$;

-- ------------------------------------------------------- WF03 programmes/events

INSERT INTO programmes(id, organization_id, programme_type, slug, name, summary, status, starts_at, ends_at, metadata, created_at, updated_at) VALUES
  ('c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000101', 'CHALLENGE', 'demo-challenge', 'Demo Challenge', 'Fixture challenge.', 'DRAFT', '2026-11-01T09:00:00Z', '2026-12-01T09:00:00Z', '{}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  programme_type = EXCLUDED.programme_type, slug = EXCLUDED.slug, name = EXCLUDED.name,
  summary = EXCLUDED.summary, status = EXCLUDED.status, starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at, updated_at = EXCLUDED.updated_at;

-- Fixed dates, not now() + interval, so screenshots never drift.
INSERT INTO events(id, organization_id, programme_id, slug, name, summary, status, starts_at, ends_at, location_text, metadata, created_at, updated_at) VALUES
  ('b0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000101', NULL,                                   'demo-event-published', 'Demo Event',       'Fixture standalone event.',        'PUBLISHED', '2026-11-15T09:00:00Z', '2026-11-15T12:00:00Z', 'Hà Nội',  '{}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000101', 'c0000000-0000-0000-0000-000000000001', 'demo-event-draft',     'Demo Draft Event', 'Fixture event linked to a programme.', 'DRAFT',    '2026-12-05T09:00:00Z', '2026-12-05T12:00:00Z', 'Đà Nẵng', '{}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  programme_id = EXCLUDED.programme_id, slug = EXCLUDED.slug, name = EXCLUDED.name,
  summary = EXCLUDED.summary, status = EXCLUDED.status, starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at, location_text = EXCLUDED.location_text,
  updated_at = EXCLUDED.updated_at;


-- ------------------------------------------------- L5 applications (DEC-L5)

-- The approved PUBLISHED WF04 programme as a read-only server row, with its
-- registration (HD-A12). Same id, name and dates as the WF04 demo fixture; the
-- operator demo keeps reading its own fixture and never writes here.
INSERT INTO programmes(id, organization_id, programme_type, slug, name, summary, status, starts_at, ends_at, metadata, created_at, updated_at) VALUES
  ('d4000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000101', 'PROGRAMME', 'demo-chuong-trinh-uom-tao', 'Chương trình ươm tạo (demo)', 'Chương trình mẫu cho Internal Alpha: đồng hành cùng các đội dự án qua ba giai đoạn.', 'PUBLISHED', '2026-09-01T02:00:00Z', '2026-12-15T10:00:00Z', '{}', '2026-09-01T02:00:00Z', '2026-09-01T02:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  programme_type = EXCLUDED.programme_type, slug = EXCLUDED.slug, name = EXCLUDED.name,
  summary = EXCLUDED.summary, status = EXCLUDED.status, starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at, updated_at = EXCLUDED.updated_at;

INSERT INTO programme_application_forms(programme_id, applicant_types, questions, version, updated_at) VALUES
  ('d4000000-0000-0000-0000-000000000001', ARRAY['TEAM','STARTUP']::applicant_type[],
   '[{"id":"q-problem","prompt":"Dự án của bạn giải quyết vấn đề gì?","required":true,"step":1},
     {"id":"q-support","prompt":"Bạn cần chương trình hỗ trợ điều gì?","required":true,"step":4}]'::jsonb,
   1, '2026-09-01T02:00:00Z')
ON CONFLICT (programme_id) DO UPDATE SET
  applicant_types = EXCLUDED.applicant_types, questions = EXCLUDED.questions,
  version = EXCLUDED.version, updated_at = EXCLUDED.updated_at
-- A form that already has applications is never rewritten, not even by a
-- re-seed: the WF04 / WF05 rule (DEC-W4P-D13, WF05 contract) holds here too.
WHERE NOT EXISTS (
  SELECT 1 FROM applications a WHERE a.programme_id = programme_application_forms.programme_id
);

COMMIT;
