-- 014_p0_legal_v1_0.sql — legal documents v1.0 (DEC-LEGAL-V1, PO 2026-10-01).
--
-- New source revision: "Điều khoản sử dụng 1hub.network" and "Chính sách quyền
-- riêng tư 1hub.network", Bản dự thảo v1.0, effective 01/10/2026 (Asia/Ho_Chi_Minh).
-- Per the content/legal convention a new revision is a new document version:
-- two new legal_documents rows; the p0-2026-09 rows stay as retired history, so
-- earlier consent records keep pointing at the text that was accepted.
--
-- The current document is the latest effective, non-retired row of each type
-- (src/lib/legal/legal.ts), so these rows become current from their effective
-- time and accounts with an older acceptance see a new version to accept.
--
-- ADDITIVE ONLY. Idempotent on (document_type, version). Text lives in
-- content/legal/<TYPE>.v1.0.md (LEGAL_CONTENT_DIR).

BEGIN;

INSERT INTO legal_documents (document_type, version, title, content_uri, effective_at)
VALUES
  ('TERMS_ACCEPTANCE', 'v1.0', 'Điều khoản sử dụng', '/legal/terms/v1.0',
   '2026-10-01T00:00:00+07:00'),
  ('PRIVACY_DATA_PROCESSING', 'v1.0', 'Chính sách quyền riêng tư', '/legal/privacy/v1.0',
   '2026-10-01T00:00:00+07:00')
ON CONFLICT (document_type, version) DO NOTHING;

-- The superseded p0-2026-09 rows are marked retired at the v1.0 effective time,
-- so their pages read "không còn hiệu lực". Current-document selection does not
-- change (it already takes the latest effective row). On a fresh database the
-- p0 fixture rows arrive later through the seed and this updates nothing.
UPDATE legal_documents
   SET retired_at = '2026-10-01T00:00:00+07:00'
 WHERE version = 'p0-2026-09' AND retired_at IS NULL;

COMMIT;
