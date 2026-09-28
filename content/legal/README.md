# Legal Content

Production legal text served through `LEGAL_CONTENT_DIR=content/legal` ([DEC-LEGAL](../../docs/decisions/DECISION_LOG.md#dec-legal)). The files are verbatim copies of the PO-approved source; never edit a word here. A new source revision needs a new document version (a `legal_documents` row) and new files.

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
