-- WF01-S06 QA-ONLY vocabulary fixture (DEC-WF01-S06-D6).
--
-- Reproduces the approved bitmap's "Chuyên môn" chips for Pixel/Playwright QA:
-- 45 ACTIVE DOMAIN/SKILL items (plus one ARCHIVED) which, with the 4 of seed_p0_deterministic.sql, give
-- the reference's 7 visible chips and "+ 42 nhóm khác". Labels are reference
-- content, NOT HUB launch taxonomy: never part of any production seed, never
-- read by application code. Applied only by the WF01-S06 spec. Deterministic
-- ids; negative sort_order places them before the seed items; idempotent.

INSERT INTO vocabulary_items(id, type_code, slug, label, sort_order, status, metadata, created_at, updated_at) VALUES
  ('e6000000-0000-0000-0000-000000000001', 'DOMAIN', 'qa-s06-van-hanh-chuoi-cung-ung', 'Vận hành chuỗi cung ứng', -99, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000002', 'DOMAIN', 'qa-s06-logistics', 'Logistics', -98, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000003', 'SKILL', 'qa-s06-phan-tich-du-lieu', 'Phân tích dữ liệu', -97, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000004', 'SKILL', 'qa-s06-quan-ly-san-pham', 'Quản lý sản phẩm', -96, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000005', 'SKILL', 'qa-s06-thuong-luong-b2b', 'Thương lượng B2B', -95, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000006', 'DOMAIN', 'qa-s06-nong-nghiep', 'Nông nghiệp', -94, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000007', 'DOMAIN', 'qa-s06-tai-chinh', 'Tài chính', -93, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000008', 'SKILL', 'qa-s06-nhom-08', 'Nhóm QA 08', -92, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000009', 'DOMAIN', 'qa-s06-nhom-09', 'Nhóm QA 09', -91, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000010', 'SKILL', 'qa-s06-nhom-10', 'Nhóm QA 10', -90, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000011', 'DOMAIN', 'qa-s06-nhom-11', 'Nhóm QA 11', -89, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000012', 'SKILL', 'qa-s06-nhom-12', 'Nhóm QA 12', -88, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000013', 'DOMAIN', 'qa-s06-nhom-13', 'Nhóm QA 13', -87, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000014', 'SKILL', 'qa-s06-nhom-14', 'Nhóm QA 14', -86, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000015', 'DOMAIN', 'qa-s06-nhom-15', 'Nhóm QA 15', -85, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000016', 'SKILL', 'qa-s06-nhom-16', 'Nhóm QA 16', -84, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000017', 'DOMAIN', 'qa-s06-nhom-17', 'Nhóm QA 17', -83, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000018', 'SKILL', 'qa-s06-nhom-18', 'Nhóm QA 18', -82, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000019', 'DOMAIN', 'qa-s06-nhom-19', 'Nhóm QA 19', -81, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000020', 'SKILL', 'qa-s06-nhom-20', 'Nhóm QA 20', -80, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000021', 'DOMAIN', 'qa-s06-nhom-21', 'Nhóm QA 21', -79, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000022', 'SKILL', 'qa-s06-nhom-22', 'Nhóm QA 22', -78, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000023', 'DOMAIN', 'qa-s06-nhom-23', 'Nhóm QA 23', -77, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000024', 'SKILL', 'qa-s06-nhom-24', 'Nhóm QA 24', -76, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000025', 'DOMAIN', 'qa-s06-nhom-25', 'Nhóm QA 25', -75, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000026', 'SKILL', 'qa-s06-nhom-26', 'Nhóm QA 26', -74, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000027', 'DOMAIN', 'qa-s06-nhom-27', 'Nhóm QA 27', -73, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000028', 'SKILL', 'qa-s06-nhom-28', 'Nhóm QA 28', -72, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000029', 'DOMAIN', 'qa-s06-nhom-29', 'Nhóm QA 29', -71, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000030', 'SKILL', 'qa-s06-nhom-30', 'Nhóm QA 30', -70, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000031', 'DOMAIN', 'qa-s06-nhom-31', 'Nhóm QA 31', -69, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000032', 'SKILL', 'qa-s06-nhom-32', 'Nhóm QA 32', -68, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000033', 'DOMAIN', 'qa-s06-nhom-33', 'Nhóm QA 33', -67, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000034', 'SKILL', 'qa-s06-nhom-34', 'Nhóm QA 34', -66, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000035', 'DOMAIN', 'qa-s06-nhom-35', 'Nhóm QA 35', -65, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000036', 'SKILL', 'qa-s06-nhom-36', 'Nhóm QA 36', -64, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000037', 'DOMAIN', 'qa-s06-nhom-37', 'Nhóm QA 37', -63, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000038', 'SKILL', 'qa-s06-nhom-38', 'Nhóm QA 38', -62, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000039', 'DOMAIN', 'qa-s06-nhom-39', 'Nhóm QA 39', -61, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000040', 'SKILL', 'qa-s06-nhom-40', 'Nhóm QA 40', -60, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000041', 'DOMAIN', 'qa-s06-nhom-41', 'Nhóm QA 41', -59, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000042', 'SKILL', 'qa-s06-nhom-42', 'Nhóm QA 42', -58, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000043', 'DOMAIN', 'qa-s06-nhom-43', 'Nhóm QA 43', -57, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000044', 'SKILL', 'qa-s06-nhom-44', 'Nhóm QA 44', -56, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  ('e6000000-0000-0000-0000-000000000045', 'DOMAIN', 'qa-s06-nhom-45', 'Nhóm QA 45', -55, 'ACTIVE', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z'),
  -- ARCHIVED: never offered; used to prove archived handling (D1).
  ('e6000000-0000-0000-0000-000000000099', 'DOMAIN', 'qa-s06-luu-tru', 'Nhóm QA lưu trữ', 0, 'ARCHIVED', '{"qa_fixture": "WF01-S06"}', '2026-01-15T09:00:00Z', '2026-01-15T09:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  type_code = EXCLUDED.type_code, slug = EXCLUDED.slug, label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order, status = EXCLUDED.status, metadata = EXCLUDED.metadata;
