# PROGRAMME-PRESENTATION-DATA-01

`/programmes` lists the approved, source-backed programmes only. No DB, API or migration change.

| Item | Value |
|---|---|
| Removed from view | the deployed programme row "Chương trình ươm tạo (demo)" ("Chương trình mẫu cho Internal Alpha…", host "Chapter 01", seed `d4000000-…0001`); no programme row is projected publicly any more |
| Source | `PROGRAMME_CARDS` (`src/components/home/home-content.ts`), the workbook rows the homepage already shows (PUBLIC-CONTENT-PUBLISH-01): one source for both pages |
| Records | APEC Innovation Challenge · VPBank Innovation Challenge · Cuộc thi Khởi nghiệp cùng Kawai · Agritech Innovation Challenge |
| Fields | name, description, host ("Chủ quản" text), type ("Cuộc thi" → Challenge), status as written ("Sắp công bố", a new phase key `sap-cong-bo`, styled like "Sắp tới"); no dates, prize, scale, image or apply entry (empty in source / no record) |
| Kept | route, search, phase / type / host filters, address (`?q=`, `?trang-thai=`, `?loai=`, `?don-vi=`, `?sap-xep=`), clear, sort, responsive layout; cards READ_ONLY ("Xem chương trình" stays inert, as for guests before) |
| Code | `src/lib/public/programme-directory.ts` (DB projection replaced by the source mapping), `programme-phase.ts` (+ `sap-cong-bo`), `programme-directory.tsx` (rank), `discovery.module.css` (one selector), `/programmes` page |
| Tests | `programme-directory.test.ts` (new); `thao-05-discovery` DIR0 rewritten for the source list (the DB fixture rows it inserts must not appear) |

Notes for the PO: the headline counts open programmes and reads "0 chương trình đang mở" (none is open in the source); the member apply entry from `/programmes` is gone with the fixture row (the apply route itself is unchanged).

## Related
- [PUBLIC-CONTENT-PUBLISH-01](PUBLIC-CONTENT-PUBLISH-01.md) · [THAO-05](THAO-05.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
