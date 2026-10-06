-- DEMO-0710 — deterministic demo ventures for the 07/10 demo
-- (docs/demo-0710/DEMO_DATA_CONTRACT.md, DEMO-D4). Applied ONLY by
-- `node scripts/db.mjs demo` (class MUTATING, DB-SAFETY-01); never part of
-- `seed`, never run against production.
--
-- Canonical rows only: 6 fictional accounts and profiles (names from the PO
-- pack, @example.test addresses, no password, cannot sign in), 3 PUBLIC
-- ACTIVE startups and their teams. Presentation content (summaries beyond the
-- canonical one, metrics, badges) lives in src/lib/demo-0710/, not here.
-- Domains not in the canonical DOMAIN list are UNNORMALIZED items (the
-- S1-UAT-03 free-tag rule); no canonical id is invented.
-- Fixed ids (prefix de710000-) and timestamps; idempotent upserts.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vocabulary_items WHERE type_code = 'REGION' AND slug = 'da-nang')
     OR NOT EXISTS (SELECT 1 FROM vocabulary_items WHERE type_code = 'VENTURE_STAGE' AND slug = 'PILOT') THEN
    RAISE EXCEPTION 'demo_0710 needs the Sprint 1 catalogue and the venture stages (run migrate + catalog first)';
  END IF;
END $$;

INSERT INTO vocabulary_items (id, type_code, slug, label, sort_order, status, metadata, created_at, updated_at) VALUES
  ('de710000-0000-0000-0000-0000000000d1', 'DOMAIN', 'logistics', 'Logistics', 0, 'UNNORMALIZED', '{"source":"DEMO-0710"}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('de710000-0000-0000-0000-0000000000d2', 'DOMAIN', 'nong-nghiep-agritech', 'Nông nghiệp & AgriTech', 0, 'UNNORMALIZED', '{"source":"DEMO-0710"}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z')
ON CONFLICT (type_code, slug) DO NOTHING;

INSERT INTO user_accounts (id, email, email_normalized, status, created_at, updated_at) VALUES
  ('de710000-0000-0000-0000-0000000000a1', 'demo0710.kimchi@example.test', 'demo0710.kimchi@example.test', 'ACTIVE', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('de710000-0000-0000-0000-0000000000a2', 'demo0710.minhanh@example.test', 'demo0710.minhanh@example.test', 'ACTIVE', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('de710000-0000-0000-0000-0000000000a3', 'demo0710.quocviet@example.test', 'demo0710.quocviet@example.test', 'ACTIVE', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('de710000-0000-0000-0000-0000000000a4', 'demo0710.hanh@example.test', 'demo0710.hanh@example.test', 'ACTIVE', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('de710000-0000-0000-0000-0000000000a5', 'demo0710.giabao@example.test', 'demo0710.giabao@example.test', 'ACTIVE', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('de710000-0000-0000-0000-0000000000a6', 'demo0710.thanhha@example.test', 'demo0710.thanhha@example.test', 'ACTIVE', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO individual_profiles (id, account_id, status, display_name, headline, region_vocab_id, onboarding_completed_at, created_at, updated_at)
SELECT p.id::uuid, p.account_id::uuid, 'ACTIVE', p.display_name, p.headline,
       (SELECT id FROM vocabulary_items WHERE type_code = 'REGION' AND slug = p.region),
       '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'
  FROM (VALUES
    ('de710000-0000-0000-0000-0000000000b1', 'de710000-0000-0000-0000-0000000000a1', 'Đặng Kim Chi', 'Đồng sáng lập · CEO @Tracely', 'da-nang'),
    ('de710000-0000-0000-0000-0000000000b2', 'de710000-0000-0000-0000-0000000000a2', 'Nguyễn Minh Anh', 'Đồng sáng lập kỹ thuật · Tracely', 'da-nang'),
    ('de710000-0000-0000-0000-0000000000b3', 'de710000-0000-0000-0000-0000000000a3', 'Phạm Quốc Việt', 'Kỹ sư backend · Tracely', 'da-nang'),
    ('de710000-0000-0000-0000-0000000000b4', 'de710000-0000-0000-0000-0000000000a4', 'Trần Hạnh', 'Vận hành thí điểm · Tracely', 'da-nang'),
    ('de710000-0000-0000-0000-0000000000b5', 'de710000-0000-0000-0000-0000000000a5', 'Lý Gia Bảo', 'Đồng sáng lập · AgriTrace', 'dong-thap'),
    ('de710000-0000-0000-0000-0000000000b6', 'de710000-0000-0000-0000-0000000000a6', 'Võ Thanh Hà', 'Nhà sáng lập · CEO tại Kho Lạnh Miền Tây', 'can-tho')
  ) AS p(id, account_id, display_name, headline, region)
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, type, owner_profile_id, slug, name, summary, status, visibility, region_id, stage_id, owner_role_label, metadata, created_at, updated_at)
SELECT v.id::uuid, 'STARTUP', v.owner::uuid, v.slug, v.name, v.summary, 'ACTIVE', 'PUBLIC',
       (SELECT id FROM vocabulary_items WHERE type_code = 'REGION' AND slug = v.region),
       (SELECT id FROM vocabulary_items WHERE type_code = 'VENTURE_STAGE' AND slug = v.stage),
       v.role, '{"demo":"DEMO-0710"}', v.created::timestamptz, '2026-10-06T00:00:00Z'
  FROM (VALUES
    ('de710000-0000-0000-0000-0000000000c1', 'de710000-0000-0000-0000-0000000000b1', 'tracely', 'Tracely',
     'Truy vết chuỗi giao vận bằng dữ liệu sẵn có — truy xuất nguồn gốc cho hợp tác xã nông sản.', 'da-nang', 'PILOT', 'Đồng sáng lập · CEO', '2025-11-20T00:00:00Z'),
    ('de710000-0000-0000-0000-0000000000c2', 'de710000-0000-0000-0000-0000000000b5', 'agritrace', 'AgriTrace',
     'Nhật ký canh tác số cho hợp tác xã, xuất hồ sơ đạt chuẩn xuất khẩu.', 'dong-thap', 'PILOT', 'Đồng sáng lập', '2025-12-01T00:00:00Z'),
    ('de710000-0000-0000-0000-0000000000c3', 'de710000-0000-0000-0000-0000000000b6', 'kho-lanh-mien-tay', 'Kho Lạnh Miền Tây',
     'Kho lạnh chia sẻ thuê theo giờ cho hộ kinh doanh nông sản nhỏ.', 'can-tho', 'SELLING', 'Nhà sáng lập · CEO', '2025-12-10T00:00:00Z')
  ) AS v(id, owner, slug, name, summary, region, stage, role, created)
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_domains (project_id, vocabulary_item_id)
SELECT d.project_id::uuid, (SELECT id FROM vocabulary_items WHERE type_code = 'DOMAIN' AND slug = d.domain)
  FROM (VALUES
    ('de710000-0000-0000-0000-0000000000c1', 'logistics'),
    ('de710000-0000-0000-0000-0000000000c1', 'nong-nghiep-agritech'),
    ('de710000-0000-0000-0000-0000000000c2', 'nong-nghiep-agritech'),
    ('de710000-0000-0000-0000-0000000000c3', 'nong-nghiep-agritech'),
    ('de710000-0000-0000-0000-0000000000c3', 'logistics')
  ) AS d(project_id, domain)
ON CONFLICT DO NOTHING;

INSERT INTO project_members (id, project_id, profile_id, role_label, state, permission, joined_at)
SELECT m.id::uuid, m.project_id::uuid, m.profile_id::uuid, m.role, 'ACTIVE', m.permission, '2026-10-06T00:00:00Z'
  FROM (VALUES
    ('de710000-0000-0000-0000-0000000000e1', 'de710000-0000-0000-0000-0000000000c1', 'de710000-0000-0000-0000-0000000000b1', 'Đồng sáng lập · CEO', 'EDIT'),
    ('de710000-0000-0000-0000-0000000000e2', 'de710000-0000-0000-0000-0000000000c1', 'de710000-0000-0000-0000-0000000000b2', 'Đồng sáng lập kỹ thuật', 'EDIT'),
    ('de710000-0000-0000-0000-0000000000e3', 'de710000-0000-0000-0000-0000000000c1', 'de710000-0000-0000-0000-0000000000b3', 'Kỹ sư backend', 'VIEW'),
    ('de710000-0000-0000-0000-0000000000e4', 'de710000-0000-0000-0000-0000000000c1', 'de710000-0000-0000-0000-0000000000b4', 'Vận hành thí điểm', 'VIEW'),
    ('de710000-0000-0000-0000-0000000000e5', 'de710000-0000-0000-0000-0000000000c2', 'de710000-0000-0000-0000-0000000000b5', 'Đồng sáng lập', 'EDIT'),
    ('de710000-0000-0000-0000-0000000000e6', 'de710000-0000-0000-0000-0000000000c3', 'de710000-0000-0000-0000-0000000000b6', 'Nhà sáng lập · CEO', 'EDIT')
  ) AS m(id, project_id, profile_id, role, permission)
ON CONFLICT (id) DO NOTHING;

COMMIT;
