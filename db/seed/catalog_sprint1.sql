-- catalog_sprint1.sql — Sprint 1 canonical catalogue (S1-UAT-03, DEC-S1O).
--
-- GENERATED from the Sprint 1 UAT pack Appendix E
-- (1hubnetwork_uat_sprint1_wf01_wf02.md "E. Danh mục dùng chung") and the
-- Sprint 1 feedback FB-06, FB-07, FB-11 (Chapter order). Names are copied
-- verbatim; nothing here is invented. Do not edit by hand.
--
--   COUNTRY  10 items (the 11th choice "Khác" is the form's own option, never a row)
--   REGION   34 Vietnamese provinces/cities (4 pinned first, then A–Z); "Khác"
--            is the form's own option
--   HUB      the existing HUB Network row (10000000-0000-0000-0000-000000000001) is marked as the catalogue's
--            "HUB Network Tổng"; it must exist (the seed, or production, holds it)
--   CHAPTER  13, children of the HUB, each with its PARENT relationship
--   CLB      55, children of their Chapter (HighSchool 7 · Hà Nội 22 · Đà Nẵng 6 ·
--            Hồ Chí Minh 20), each with its PARENT relationship
--
-- Catalogue rows carry metadata {"catalog":"S1_APPENDIX_E","catalog_order":n}: the
-- onboarding declaration (US-01.11) offers exactly these units, in this order.
--
-- Deterministic and idempotent: fixed ids and timestamps, upserts only, so a
-- second run changes nothing. Existing rows matched by slug (the three seeded
-- provinces, Việt Nam) keep their ids and take the canonical label and order.
-- Applied by `node scripts/db.mjs seed` (after the fixture seed) and on its own
-- by `node scripts/db.mjs catalog`.

BEGIN;

DO $catalog$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = '10000000-0000-0000-0000-000000000001' AND type = 'HUB') THEN
    RAISE EXCEPTION 'catalog_sprint1: the HUB Network row 10000000-0000-0000-0000-000000000001 is missing';
  END IF;
END
$catalog$;

-- Quốc gia/Khu vực (Appendix E, 11 choices = these 10 + "Khác").
INSERT INTO vocabulary_items (id, type_code, slug, label, sort_order, status, metadata, created_at, updated_at) VALUES
  ('21000000-0000-0000-0000-000000000001', 'COUNTRY', 'vn', 'Việt Nam', 10, 'ACTIVE', '{"catalog":"S1_APPENDIX_E"}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('21000000-0000-0000-0000-000000000002', 'COUNTRY', 'sg', 'Singapore', 20, 'ACTIVE', '{"catalog":"S1_APPENDIX_E"}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('21000000-0000-0000-0000-000000000003', 'COUNTRY', 'cn', 'Trung Quốc Đại lục', 30, 'ACTIVE', '{"catalog":"S1_APPENDIX_E"}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('21000000-0000-0000-0000-000000000004', 'COUNTRY', 'tw', 'Đài Loan', 40, 'ACTIVE', '{"catalog":"S1_APPENDIX_E"}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('21000000-0000-0000-0000-000000000005', 'COUNTRY', 'hk', 'Hồng Kông', 50, 'ACTIVE', '{"catalog":"S1_APPENDIX_E"}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('21000000-0000-0000-0000-000000000006', 'COUNTRY', 'gb', 'Vương quốc Anh', 60, 'ACTIVE', '{"catalog":"S1_APPENDIX_E"}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('21000000-0000-0000-0000-000000000007', 'COUNTRY', 'us', 'Hoa Kỳ', 70, 'ACTIVE', '{"catalog":"S1_APPENDIX_E"}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('21000000-0000-0000-0000-000000000008', 'COUNTRY', 'au', 'Úc', 80, 'ACTIVE', '{"catalog":"S1_APPENDIX_E"}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('21000000-0000-0000-0000-000000000009', 'COUNTRY', 'eu', 'Châu Âu', 90, 'ACTIVE', '{"catalog":"S1_APPENDIX_E"}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('21000000-0000-0000-0000-00000000000a', 'COUNTRY', 'ae', 'Các Tiểu vương quốc Ả Rập Thống nhất', 100, 'ACTIVE', '{"catalog":"S1_APPENDIX_E"}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z')
ON CONFLICT (type_code, slug) DO UPDATE SET
  label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, status = 'ACTIVE',
  metadata = vocabulary_items.metadata || EXCLUDED.metadata;

-- Tỉnh/Thành phố — Việt Nam (Appendix E, 34 + "Khác"): 4 pinned, then A–Z.
INSERT INTO vocabulary_items (id, type_code, slug, label, sort_order, status, metadata, created_at, updated_at) VALUES
  ('24000000-0000-0000-0000-000000000001', 'REGION', 'hanoi', 'TP. Hà Nội', 10, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":true}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000002', 'REGION', 'ho-chi-minh', 'TP. Hồ Chí Minh', 20, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":true}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000003', 'REGION', 'da-nang', 'TP. Đà Nẵng', 30, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":true}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000004', 'REGION', 'quang-ninh', 'TP. Quảng Ninh', 40, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":true}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000005', 'REGION', 'an-giang', 'An Giang', 100, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000006', 'REGION', 'bac-ninh', 'Bắc Ninh', 110, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000007', 'REGION', 'ca-mau', 'Cà Mau', 120, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000008', 'REGION', 'cao-bang', 'Cao Bằng', 130, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000009', 'REGION', 'can-tho', 'TP. Cần Thơ', 140, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-00000000000a', 'REGION', 'dak-lak', 'Đắk Lắk', 150, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-00000000000b', 'REGION', 'dien-bien', 'Điện Biên', 160, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-00000000000c', 'REGION', 'dong-nai', 'Đồng Nai', 170, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-00000000000d', 'REGION', 'dong-thap', 'Đồng Tháp', 180, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-00000000000e', 'REGION', 'gia-lai', 'Gia Lai', 190, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-00000000000f', 'REGION', 'ha-tinh', 'Hà Tĩnh', 200, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000010', 'REGION', 'hai-phong', 'TP. Hải Phòng', 210, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000011', 'REGION', 'hue', 'TP. Huế', 220, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000012', 'REGION', 'hung-yen', 'Hưng Yên', 230, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000013', 'REGION', 'khanh-hoa', 'Khánh Hòa', 240, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000014', 'REGION', 'lai-chau', 'Lai Châu', 250, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000015', 'REGION', 'lam-dong', 'Lâm Đồng', 260, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000016', 'REGION', 'lang-son', 'Lạng Sơn', 270, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000017', 'REGION', 'lao-cai', 'Lào Cai', 280, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000018', 'REGION', 'nghe-an', 'Nghệ An', 290, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000019', 'REGION', 'ninh-binh', 'Ninh Bình', 300, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-00000000001a', 'REGION', 'phu-tho', 'Phú Thọ', 310, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-00000000001b', 'REGION', 'quang-ngai', 'Quảng Ngãi', 320, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-00000000001c', 'REGION', 'quang-tri', 'Quảng Trị', 330, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-00000000001d', 'REGION', 'son-la', 'Sơn La', 340, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-00000000001e', 'REGION', 'tay-ninh', 'Tây Ninh', 350, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-00000000001f', 'REGION', 'thai-nguyen', 'Thái Nguyên', 360, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000020', 'REGION', 'thanh-hoa', 'Thanh Hóa', 370, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000021', 'REGION', 'tuyen-quang', 'Tuyên Quang', 380, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('24000000-0000-0000-0000-000000000022', 'REGION', 'vinh-long', 'Vĩnh Long', 390, 'ACTIVE', '{"catalog":"S1_APPENDIX_E","country":"vn","pinned":false}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z')
ON CONFLICT (type_code, slug) DO UPDATE SET
  label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, status = 'ACTIVE',
  metadata = vocabulary_items.metadata || EXCLUDED.metadata;

-- HUB Network Tổng: the existing HUB row joins the catalogue.
UPDATE organizations SET metadata = metadata || '{"catalog":"S1_APPENDIX_E","catalog_order":0}'
 WHERE id = '10000000-0000-0000-0000-000000000001' AND NOT (metadata @> '{"catalog":"S1_APPENDIX_E","catalog_order":0}');

-- 13 Chapters (FB-11 order) and 55 CLBs (Appendix E order).
INSERT INTO organizations (id, type, parent_id, slug, name, description, status, metadata, created_at, updated_at) VALUES
  ('1c000000-0000-0000-0000-000000000001', 'CHAPTER', '10000000-0000-0000-0000-000000000001', 'hub-network-highschool', 'HUB Network HighSchool', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":1}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000001', 'CLB', '1c000000-0000-0000-0000-000000000001', 'clb-highschool-vietnam-youth-leadership-organization', 'Vietnam Youth Leadership Organization', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":1}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000002', 'CLB', '1c000000-0000-0000-0000-000000000001', 'clb-highschool-csp-potential-entrepreneurship-club', 'CSP Potential Entrepreneurship Club', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":2}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000003', 'CLB', '1c000000-0000-0000-0000-000000000001', 'clb-highschool-newton-business-initiative', 'Newton Business Initiative', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":3}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000004', 'CLB', '1c000000-0000-0000-0000-000000000001', 'clb-highschool-the-olympia-schools-seia', 'The Olympia Schools SEIA', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":4}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000005', 'CLB', '1c000000-0000-0000-0000-000000000001', 'clb-highschool-the-dewey-schools-seia', 'The Dewey Schools SEIA', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":5}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000006', 'CLB', '1c000000-0000-0000-0000-000000000001', 'clb-highschool-hanoi-amsterdam-seia', 'Hanoi-Amsterdam SEIA', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":6}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000007', 'CLB', '1c000000-0000-0000-0000-000000000001', 'clb-highschool-the-beacon-club-of-nguyen-sieu', 'The Beacon Club of Nguyễn Siêu', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":7}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1c000000-0000-0000-0000-000000000002', 'CHAPTER', '10000000-0000-0000-0000-000000000001', 'hub-network-business', 'HUB Network Business', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":2}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1c000000-0000-0000-0000-000000000003', 'CHAPTER', '10000000-0000-0000-0000-000000000001', 'hub-network-ha-noi', 'HUB Network Hà Nội', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":3}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000008', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-tec-clb-nha-doanh-nghiep-tuong-lai', 'TEC - CLB Nhà Doanh nghiệp Tương lai', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":1}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000009', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-hiec-clb-sang-tao-va-khoi-nghiep-hust', 'HIEC - CLB Sáng tạo và Khởi nghiệp HUST', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":2}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-00000000000a', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-egg-clb-sang-tao-cong-nghe-egg', 'EGG - CLB Sáng tạo công nghệ EGG', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":3}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-00000000000b', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-lch-dau-tu-lien-chi-hoi-dau-tu', 'LCH Đầu tư - Liên Chi hội Đầu Tư', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":4}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-00000000000c', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-stc-clb-khoi-nghiep-hoc-vien-ngan-hang', 'STC - CLB Khởi nghiệp Học viện Ngân hàng', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":5}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-00000000000d', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-bsc-clb-ky-nang-kinh-doanh', 'BSC - CLB Kỹ năng Kinh doanh', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":6}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-00000000000e', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-iec-clb-khoi-nghiep-hvtc', 'IEC - CLB Khởi nghiệp HVTC', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":7}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-00000000000f', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-sisc-clb-ho-tro-khoi-nghiep-va-doi-moi-sang-tao-dh-y-ha-noi', 'SISC - CLB Hỗ trợ Khởi nghiệp và Đổi mới sáng tạo ĐH Y Hà Nội', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":8}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000010', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-dynamic-clb-kinh-doanh-va-khoi-nghiep', 'Dynamic - CLB Kinh doanh và Khởi nghiệp', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":9}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000011', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-sip-clb-khoi-nghiep-sip-haui', 'SIP - CLB Khởi nghiệp SIP HaUI', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":10}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000012', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-clb-khoi-nghiep-va-sang-tao-ush-ulsa', 'CLB Khởi nghiệp và Sáng tạo USH - ULSA', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":11}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000013', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-tsc-clb-khoi-nghiep-dai-hoc-thuy-loi', 'TSC - CLB Khởi nghiệp Đại học Thủy lợi', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":12}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000014', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-hsh-clb-khoi-nghiep-dai-hoc-mo-ha-noi', 'HSH - CLB Khởi nghiệp Đại học Mở Hà Nội', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":13}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000015', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-vinnovation-vinuni-innovation-entrepreneurship-club', 'Vinnovation - VinUni Innovation & Entrepreneurship Club', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":14}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000016', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-sat-clb-khoi-nghiep-va-cong-nghe-dh-khoa-hoc-tu-nhien', 'SAT - CLB Khởi nghiệp và Công nghệ ĐH Khoa học Tự nhiên', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":15}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000017', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-iec-clb-khoi-nghiep-sang-tao-dh-phenikaa', 'IEC - CLB Khởi nghiệp Sáng tạo ĐH Phenikaa', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":16}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000018', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-leih-clb-khoi-nghiep-va-doi-moi-sang-tao-truong-dh-luat-ha-noi', 'LEIH - CLB Khởi nghiệp và Đổi mới sáng tạo Trường ĐH Luật Hà Nội', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":17}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000019', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-fba-clb-nha-quan-tri-tuong-lai', 'FBA - CLB Nhà Quản trị Tương lai', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":18}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-00000000001a', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-rmit-innovation-entrepreneurship-club-hanoi', 'RMIT Innovation & Entrepreneurship Club Hanoi', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":19}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-00000000001b', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-hrc-clb-nguon-nhan-luc', 'HRC - CLB Nguồn nhân lực', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":20}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-00000000001c', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-dcie-clb-khoi-nghiep-va-dmst-dh-dai-nam', 'DCIE - CLB Khởi nghiệp và ĐMST ĐH Đại Nam', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":21}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-00000000001d', 'CLB', '1c000000-0000-0000-0000-000000000003', 'clb-ha-noi-iec-ptit-clb-khoi-nghiep-va-dmst-hoc-vien-ptit', 'IEC PTIT - CLB Khởi nghiệp và ĐMST Học viện PTIT', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":22}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1c000000-0000-0000-0000-000000000004', 'CHAPTER', '10000000-0000-0000-0000-000000000001', 'hub-network-da-nang', 'HUB Network Đà Nẵng', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":4}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-00000000001e', 'CLB', '1c000000-0000-0000-0000-000000000004', 'clb-da-nang-startup-student-club-dtu', 'Startup Student Club DTU', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":1}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-00000000001f', 'CLB', '1c000000-0000-0000-0000-000000000004', 'clb-da-nang-doi-moi-sang-tao-khoi-nghiep-ued', 'Đổi mới sáng tạo khởi nghiệp UED', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":2}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000020', 'CLB', '1c000000-0000-0000-0000-000000000004', 'clb-da-nang-teen-innovators-network-society-tins', 'Teen Innovators Network-Society (TINS)', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":3}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000021', 'CLB', '1c000000-0000-0000-0000-000000000004', 'clb-da-nang-clb-khoi-nghiep-kinh-te', 'CLB Khởi nghiệp Kinh tế', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":4}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000022', 'CLB', '1c000000-0000-0000-0000-000000000004', 'clb-da-nang-clb-nghien-cuu-khoa-hoc-khoi-nghiep-c-e-d-yd-dumtp', 'CLB Nghiên cứu khoa học - Khởi nghiệp C.E.D YD - DUMTP', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":5}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000023', 'CLB', '1c000000-0000-0000-0000-000000000004', 'clb-da-nang-resup-business-marketing-club', 'RESUP - Business & Marketing Club', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":6}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1c000000-0000-0000-0000-000000000005', 'CHAPTER', '10000000-0000-0000-0000-000000000001', 'hub-network-ho-chi-minh', 'HUB Network Hồ Chí Minh', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":5}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000024', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-clb-nha-khoi-nghiep-tre-truong-dh-nguyen-tat-thanh', 'CLB Nhà Khởi nghiệp Trẻ - Trường ĐH Nguyễn Tất Thành', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":1}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000025', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-clb-sinh-vien-khoi-nghiep-dynamic-ueh', 'CLB Sinh viên Khởi nghiệp Dynamic UEH', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":2}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000026', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-khoi-nghiep-dai-hoc-ton-duc-thang-sc-tdtu', 'Khởi nghiệp Đại học Tôn Đức Thắng - SC TDTU', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":3}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000027', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-ehub-cong-dong-khoi-nghiep-tre-ftu2', 'EHub - Cộng đồng khởi nghiệp trẻ FTU2', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":4}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000028', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-clb-khoi-nghiep-sse', 'CLB Khởi nghiệp SSE', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":5}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000029', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-fic-entrepreneurship', 'FIC - Entrepreneurship', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":6}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-00000000002a', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-fulbright-business-club', 'Fulbright Business Club', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":7}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-00000000002b', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-clb-khoi-nghiep-nsc', 'CLB Khởi nghiệp NSC', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":8}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-00000000002c', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-clb-nhan-su-khoi-nghiep-hr-startup', 'CLB Nhân sự - Khởi nghiệp (HR - Startup)', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":9}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-00000000002d', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-future-marketer-international-businessman', 'Future Marketer & International Businessman', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":10}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-00000000002e', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-clb-khoi-nghiep-doi-moi-sang-tao-khoa-hoc-truong-khoa-hoc-tu-nhien-dhqg-hcm', 'CLB Khởi nghiệp Đổi mới Sáng tạo Khoa học trường Khoa học tự nhiên, ĐHQG-HCM', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":11}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-00000000002f', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-clb-doanh-nghiep-tre-dai-hoc-van-lang', 'CLB Doanh nghiệp Trẻ - Đại học Văn Lang', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":12}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000030', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-siu-start-up-club', 'SIU START-UP CLUB', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":13}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000031', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-clb-khoi-nghiep-sinh-vien-truong-dai-hoc-van-lang', 'CLB Khởi nghiệp Sinh viên Trường Đại học Văn Lang', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":14}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000032', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-sus-swinburne-business-club', 'SUS - Swinburne Business Club', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":15}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000033', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-clb-khoi-nghiep-truong-dai-hoc-tra-vinh', 'CLB Khởi nghiệp trường Đại học Trà Vinh', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":16}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000034', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-business-ideas-hub', 'Business Ideas Hub', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":17}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000035', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-business-ideas-team', 'Business Ideas Team', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":18}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000036', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-tssc-clb-sinh-vien-khoi-nghiep-truong-dai-hoc-thu-dau-mot', 'TSSC - CLB Sinh viên Khởi nghiệp Trường Đại học Thủ Dầu Một', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":19}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1d000000-0000-0000-0000-000000000037', 'CLB', '1c000000-0000-0000-0000-000000000005', 'clb-ho-chi-minh-clb-nhan-van-khoi-nghiep-sang-tao-xa-hoi', 'CLB Nhân văn Khởi nghiệp - Sáng tạo Xã hội', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":20}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1c000000-0000-0000-0000-000000000006', 'CHAPTER', '10000000-0000-0000-0000-000000000001', 'hub-network-quang-ninh', 'HUB Network Quảng Ninh', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":6}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1c000000-0000-0000-0000-000000000007', 'CHAPTER', '10000000-0000-0000-0000-000000000001', 'hub-network-trung-quoc-china', 'HUB Network Trung Quốc (China)', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":7}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1c000000-0000-0000-0000-000000000008', 'CHAPTER', '10000000-0000-0000-0000-000000000001', 'hub-network-singapore', 'HUB Network Singapore', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":8}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1c000000-0000-0000-0000-000000000009', 'CHAPTER', '10000000-0000-0000-0000-000000000001', 'hub-network-chau-au-eu', 'HUB Network Châu Âu (EU)', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":9}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1c000000-0000-0000-0000-00000000000a', 'CHAPTER', '10000000-0000-0000-0000-000000000001', 'hub-network-vuong-quoc-anh-uk', 'HUB Network Vương quốc Anh (UK)', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":10}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1c000000-0000-0000-0000-00000000000b', 'CHAPTER', '10000000-0000-0000-0000-000000000001', 'hub-network-hoa-ky-usa', 'HUB Network Hoa Kỳ (USA)', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":11}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1c000000-0000-0000-0000-00000000000c', 'CHAPTER', '10000000-0000-0000-0000-000000000001', 'hub-network-cac-tieu-vuong-quoc-a-rap-thong-nhat-uae', 'HUB Network các Tiểu vương quốc Ả Rập Thống nhất (UAE)', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":12}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z'),
  ('1c000000-0000-0000-0000-00000000000d', 'CHAPTER', '10000000-0000-0000-0000-000000000001', 'hub-network-uc-australia', 'HUB Network Úc (Australia)', NULL, 'PUBLISHED', '{"catalog":"S1_APPENDIX_E","catalog_order":13}', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  type = EXCLUDED.type, parent_id = EXCLUDED.parent_id, slug = EXCLUDED.slug,
  name = EXCLUDED.name, status = EXCLUDED.status,
  metadata = organizations.metadata || EXCLUDED.metadata;

-- Canonical PARENT relationships (DEC-WF03-C2), one active parent per child.
INSERT INTO organization_relationships (id, source_org_id, target_org_id, relationship_type, state, started_at, metadata, created_at) VALUES
  ('dc000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003e9', '1c000000-0000-0000-0000-000000000001', '1d000000-0000-0000-0000-000000000001', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003ea', '1c000000-0000-0000-0000-000000000001', '1d000000-0000-0000-0000-000000000002', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003eb', '1c000000-0000-0000-0000-000000000001', '1d000000-0000-0000-0000-000000000003', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003ec', '1c000000-0000-0000-0000-000000000001', '1d000000-0000-0000-0000-000000000004', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003ed', '1c000000-0000-0000-0000-000000000001', '1d000000-0000-0000-0000-000000000005', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003ee', '1c000000-0000-0000-0000-000000000001', '1d000000-0000-0000-0000-000000000006', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003ef', '1c000000-0000-0000-0000-000000000001', '1d000000-0000-0000-0000-000000000007', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000002', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000003', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003f0', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-000000000008', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003f1', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-000000000009', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003f2', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-00000000000a', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003f3', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-00000000000b', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003f4', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-00000000000c', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003f5', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-00000000000d', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003f6', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-00000000000e', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003f7', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-00000000000f', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003f8', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-000000000010', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003f9', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-000000000011', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003fa', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-000000000012', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003fb', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-000000000013', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003fc', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-000000000014', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003fd', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-000000000015', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003fe', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-000000000016', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-0000000003ff', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-000000000017', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000400', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-000000000018', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000401', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-000000000019', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000402', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-00000000001a', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000403', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-00000000001b', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000404', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-00000000001c', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000405', '1c000000-0000-0000-0000-000000000003', '1d000000-0000-0000-0000-00000000001d', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000004', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000406', '1c000000-0000-0000-0000-000000000004', '1d000000-0000-0000-0000-00000000001e', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000407', '1c000000-0000-0000-0000-000000000004', '1d000000-0000-0000-0000-00000000001f', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000408', '1c000000-0000-0000-0000-000000000004', '1d000000-0000-0000-0000-000000000020', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000409', '1c000000-0000-0000-0000-000000000004', '1d000000-0000-0000-0000-000000000021', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-00000000040a', '1c000000-0000-0000-0000-000000000004', '1d000000-0000-0000-0000-000000000022', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-00000000040b', '1c000000-0000-0000-0000-000000000004', '1d000000-0000-0000-0000-000000000023', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000005', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-00000000040c', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-000000000024', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-00000000040d', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-000000000025', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-00000000040e', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-000000000026', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-00000000040f', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-000000000027', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000410', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-000000000028', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000411', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-000000000029', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000412', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-00000000002a', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000413', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-00000000002b', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000414', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-00000000002c', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000415', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-00000000002d', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000416', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-00000000002e', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000417', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-00000000002f', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000418', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-000000000030', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000419', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-000000000031', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-00000000041a', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-000000000032', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-00000000041b', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-000000000033', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-00000000041c', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-000000000034', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-00000000041d', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-000000000035', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-00000000041e', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-000000000036', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-00000000041f', '1c000000-0000-0000-0000-000000000005', '1d000000-0000-0000-0000-000000000037', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000006', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000007', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000008', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000009', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-00000000000a', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-00000000000b', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-00000000000c', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z'),
  ('dc000000-0000-0000-0000-00000000000d', '10000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-00000000000d', 'PARENT', 'ACTIVE', '2026-10-06T00:00:00Z', '{}', '2026-10-06T00:00:00Z')
ON CONFLICT DO NOTHING;

COMMIT;
