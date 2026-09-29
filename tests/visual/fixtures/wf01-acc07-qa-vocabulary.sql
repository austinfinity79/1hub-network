-- ACC-07 QA-ONLY vocabulary fixture (DEC-L1R-D8). Supersedes wf01-s06-qa-vocabulary.sql.
--
-- Reproduces the L1 board's "Lĩnh vực quan tâm" chips and "Kỹ năng" tags for
-- Pixel/Playwright QA: 34 ACTIVE DOMAIN items which, with the 2 of
-- seed_p0_deterministic.sql, give the board's 8 visible chips and
-- "+ 28 lĩnh vực khác"; 6 ACTIVE SKILL items; one ARCHIVED DOMAIN item. Labels
-- are reference content, NOT HUB launch taxonomy: never part of any production
-- seed, never read by application code. Applied only by specs. Deterministic
-- ids; negative sort_order places them before the seed items; idempotent.
--
-- The rows of the older WF01-S06 fixture are archived first, so a database
-- that still holds them shows the same chips as a fresh one.

UPDATE vocabulary_items SET status = 'ARCHIVED'
 WHERE metadata->>'qa_fixture' = 'WF01-S06' AND status <> 'ARCHIVED';

INSERT INTO vocabulary_items(id, type_code, slug, label, sort_order, status, metadata, created_at, updated_at) VALUES
  ('e7000000-0000-0000-0000-000000000001', 'DOMAIN', 'qa-acc07-logistics', 'Logistics', -300, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000002', 'DOMAIN', 'qa-acc07-agritech', 'AgriTech', -299, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000003', 'DOMAIN', 'qa-acc07-climate-tech', 'Climate Tech', -298, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000004', 'DOMAIN', 'qa-acc07-truy-xuat-nguon-goc', 'Truy xuất nguồn gốc', -297, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000005', 'DOMAIN', 'qa-acc07-ai', 'AI', -296, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000006', 'DOMAIN', 'qa-acc07-fintech', 'Fintech', -295, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000007', 'DOMAIN', 'qa-acc07-edtech', 'EdTech', -294, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000008', 'DOMAIN', 'qa-acc07-healthtech', 'HealthTech', -293, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000009', 'DOMAIN', 'qa-acc07-linh-vuc-09', 'Lĩnh vực QA 09', -292, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000010', 'DOMAIN', 'qa-acc07-linh-vuc-10', 'Lĩnh vực QA 10', -291, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000011', 'DOMAIN', 'qa-acc07-linh-vuc-11', 'Lĩnh vực QA 11', -290, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000012', 'DOMAIN', 'qa-acc07-linh-vuc-12', 'Lĩnh vực QA 12', -289, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000013', 'DOMAIN', 'qa-acc07-linh-vuc-13', 'Lĩnh vực QA 13', -288, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000014', 'DOMAIN', 'qa-acc07-linh-vuc-14', 'Lĩnh vực QA 14', -287, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000015', 'DOMAIN', 'qa-acc07-linh-vuc-15', 'Lĩnh vực QA 15', -286, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000016', 'DOMAIN', 'qa-acc07-linh-vuc-16', 'Lĩnh vực QA 16', -285, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000017', 'DOMAIN', 'qa-acc07-linh-vuc-17', 'Lĩnh vực QA 17', -284, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000018', 'DOMAIN', 'qa-acc07-linh-vuc-18', 'Lĩnh vực QA 18', -283, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000019', 'DOMAIN', 'qa-acc07-linh-vuc-19', 'Lĩnh vực QA 19', -282, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000020', 'DOMAIN', 'qa-acc07-linh-vuc-20', 'Lĩnh vực QA 20', -281, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000021', 'DOMAIN', 'qa-acc07-linh-vuc-21', 'Lĩnh vực QA 21', -280, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000022', 'DOMAIN', 'qa-acc07-linh-vuc-22', 'Lĩnh vực QA 22', -279, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000023', 'DOMAIN', 'qa-acc07-linh-vuc-23', 'Lĩnh vực QA 23', -278, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000024', 'DOMAIN', 'qa-acc07-linh-vuc-24', 'Lĩnh vực QA 24', -277, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000025', 'DOMAIN', 'qa-acc07-linh-vuc-25', 'Lĩnh vực QA 25', -276, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000026', 'DOMAIN', 'qa-acc07-linh-vuc-26', 'Lĩnh vực QA 26', -275, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000027', 'DOMAIN', 'qa-acc07-linh-vuc-27', 'Lĩnh vực QA 27', -274, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000028', 'DOMAIN', 'qa-acc07-linh-vuc-28', 'Lĩnh vực QA 28', -273, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000029', 'DOMAIN', 'qa-acc07-linh-vuc-29', 'Lĩnh vực QA 29', -272, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000030', 'DOMAIN', 'qa-acc07-linh-vuc-30', 'Lĩnh vực QA 30', -271, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000031', 'DOMAIN', 'qa-acc07-linh-vuc-31', 'Lĩnh vực QA 31', -270, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000032', 'DOMAIN', 'qa-acc07-linh-vuc-32', 'Lĩnh vực QA 32', -269, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000033', 'DOMAIN', 'qa-acc07-linh-vuc-33', 'Lĩnh vực QA 33', -268, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000034', 'DOMAIN', 'qa-acc07-linh-vuc-34', 'Lĩnh vực QA 34', -267, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000051', 'SKILL', 'qa-acc07-phan-tich-du-lieu', 'Phân tích dữ liệu', -300, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000052', 'SKILL', 'qa-acc07-dam-phan-b2b', 'Đàm phán B2B', -299, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000053', 'SKILL', 'qa-acc07-pitching', 'Pitching', -298, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000054', 'SKILL', 'qa-acc07-nghien-cuu', 'Nghiên cứu', -297, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000055', 'SKILL', 'qa-acc07-goi-von', 'Gọi vốn', -296, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000056', 'SKILL', 'qa-acc07-ui-ux', 'UI/UX', -295, 'ACTIVE', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e7000000-0000-0000-0000-000000000099', 'DOMAIN', 'qa-acc07-luu-tru', 'Lĩnh vực QA lưu trữ', 0, 'ARCHIVED', '{"qa_fixture": "WF01-ACC07"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  type_code = EXCLUDED.type_code, slug = EXCLUDED.slug, label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order, status = EXCLUDED.status, metadata = EXCLUDED.metadata;
