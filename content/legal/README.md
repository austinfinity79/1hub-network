# Legal Content

Production legal text served through `LEGAL_CONTENT_DIR=content/legal` ([DEC-LEGAL](../../docs/decisions/DECISION_LOG.md#dec-legal)). The files are verbatim copies of the PO-approved source; never edit a word here. A new source revision needs a new document version (a `legal_documents` row) and new files.

## v1.0 (current from 01/10/2026, DEC-LEGAL-V1)

| Item | Value |
|---|---|
| Source | `1hub_network_Dieu_khoan_su_dung_du_thao_v1.0 (1).docx`, `1hub_network_Chinh_sach_quyen_rieng_tu_du_thao_v1.0 (1).docx` — Bản dự thảo v1.0, Ngày soạn 29/09/2026 |
| Source SHA-256 | terms `fbd4f9ebdece76e1dbf3cf72596c2f23a276a76b43c8f785281699bd1a822e04`; privacy `cb3cf4422eba52ea0f55cc9d0a9cd9bf1c58b271bad19004b4b101eab6de6b11` |
| Approved edits | "Ngày hiệu lực [CẦN XÁC NHẬN]" → "Ngày hiệu lực 01/10/2026"; "[EMAIL HỖ TRỢ]" → "global@1hub.network". Nothing else |
| Files | `TERMS_ACCEPTANCE.v1.0.md` (14 sections), `PRIVACY_DATA_PROCESSING.v1.0.md` (12 sections); rows from migration `014_p0_legal_v1_0.sql` |
| Conversion | one source paragraph per block; layout markers only: `# ` title, `> ` metadata line, `## ` section heading. Text identical to the source after the two edits (7,399 and 6,671 non-space characters) |

## p0-2026-09 (history)

| Item | Value |
|---|---|
| Source | `1Hub_Dieu_khoan_su_dung_va_Chinh_sach_quyen_rieng_tu_v1.5.docx` — "Điều khoản sử dụng và Chính sách quyền riêng tư", Phiên bản 1.5, cập nhật ngày 24/09/2026, 1Hub Holding |
| Source SHA-256 | `dec6f075a1e0633df482525f8b369aaefd4041ff36a8b3a40f26d3d0921f9ba2` |
| Approved | PO, 2026-09-28 (FINAL RELEASE BLOCKER CLOSURE) |
| `TERMS_ACCEPTANCE.p0-2026-09.md` | opening block and Phần A (A1–A10) |
| `PRIVACY_DATA_PROCESSING.p0-2026-09.md` | Phần B (B1–B15) |
| Conversion | one source paragraph per block, blank-line separated; the B7 table as one line per row, cells joined by ` \| `; page footer omitted. Text identical to an independent `textutil` extraction (26,214 non-space characters) |

## Related
- [../legal-fixtures/](../legal-fixtures/) — non-production fixtures for dev / test servers
- [../../src/lib/legal/content.ts](../../src/lib/legal/content.ts) — the loader
