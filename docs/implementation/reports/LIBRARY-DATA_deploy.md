# LIBRARY-DATA Deploy

**LIBRARY DATA UPDATE + DEPLOY: DEPLOYED GREEN.** `2c6cc4a` runs on https://1hubnetwork.io.vn. "Bài toán" shows the supplied problem dataset; no Library tab names a data source ([DEC-L15-D9](../../decisions/DECISION_LOG.md#dec-l15-d9)).

## Problem dataset
| Item | Result |
|---|---|
| Source | `dir-bai-toan.json` (PO, 29/09), shipped byte-identical as `src/lib/library/dir-bai-toan.json` |
| Records | 47 loaded, 47 counted (tab, list, "Xem thêm" reaches all 47 in dataset order); the 6 demo problems removed |
| Lĩnh vực | 27 values from `tags.linh_vuc`, counts from the records (largest: Dữ liệu & AI 11) |
| Giai đoạn | Đang mở nộp 0, Sắp diễn ra 47, Đang chấm 0, Đã công bố 0 |
| Địa bàn | 4 values from `tags.dia_ban` (Hà Nội 47) |
| Hero metric | "bài toán đang mở" = 0 (no record is `dang_mo_nop`) |

## Null handling
| Field | Data | Shown |
|---|---|---|
| Prize | `giai_thuong` null on 47 (display "—" 30, "Đang đàm phán" 17) | no prize chip |
| Deadline | `han_nop` null on 47 | the supplied "Chưa mở nhận giải pháp"; no countdown |
| Team count | `so_doi_du_kien` null on 47 | no team chip |
| Logo | `owner_org.logo_url` null on 47 | blank mark (logo drawing not built) |
| Sort | no deadline or prize values | both orders keep the dataset order |

## Source labels removed
Hero caption "Bài toán: dữ liệu minh hoạ · Startup, nhà sáng lập: startup.1hub.cloud", the results-bar tag ("Dữ liệu minh hoạ" / "Nguồn: startup.1hub.cloud") and the provider name in the Startup error state. Source URL and adapters stay in code.

## Gates
| Gate | Result |
|---|---|
| format, lint, typecheck, production build | PASS |
| Unit | `src/lib/library` 17 / 17 (7 new: adapter, facets, null rules, order) |
| `public-library` | 16 / 16; L15 pixel keeps the sidebar and toolbar (1.24 % / 0.81 %, 0.81 % / 1.92 %); card rows checked by geometry (columns, 324 × 431, 23 px gaps, row 3 at 1866) because their colour band, text and chips are record data |
| Widths 1440 / 1024 / 768 / 390 | 200, overflow 0, #418 0, 4xx / 5xx 0, broken images 0, on all three tabs |

## Release
| Item | Value |
|---|---|
| Deployed SHA | `2c6cc4ac4f42df252d81afc467ec541c622a07af` |
| Previous / rollback SHA | `91ba7a8de792bb7e382a94050f620c1f61bc8bc5` (`rollback.sh`) |
| DB | untouched: no migration, no seed; backup `onehub-20260929T104837Z.dump` (130 017 bytes) taken by procedure |
| Domain | the checks above on https://1hubnetwork.io.vn; Startup 72, Nhà sáng lập 84; Nginx 5xx 0 (404 only `/health`); app log errors 0 |

## Related
- [HOMEPAGE-IMAGES_deploy.md](HOMEPAGE-IMAGES_deploy.md) — previous release
