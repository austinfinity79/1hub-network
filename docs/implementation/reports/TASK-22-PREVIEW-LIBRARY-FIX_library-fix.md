# TASK-22-PREVIEW-LIBRARY-FIX Library Fix

**TASK 22-PREVIEW-LIBRARY-FIX — real startup.json data + pixel UI remap: DONE (local).** Implementation `e128d1c`. Decisions [DEC-L15-D7, D8](../../decisions/DECISION_LOG.md#dec-l15) (D1, D3, D6 revised). Not deployed, not pushed.

## Remote data (fetched 28/09)
| Item | Value |
|---|---|
| URL / HTTP | `https://startup.1hub.cloud/data/startup.json` · 200 · `application/json` · 132 KB · `cache-control: no-cache` |
| Root | JSON array, 72 records; no id, logo or location field |
| Fields | `ten_startup` 72 · `mo_ta_ngan` 72 · `mo_ta_chi_tiet` 72 · `linh_vuc[]` free text, 63 distinct values (2 empty) · `giai_doan_phat_trien` MVP 27 / Growth 19 / Scale-up 11 / Ideation 7 / Prototype 1 / null 7 · `website` 44 (13 http) · `san_pham_chinh` 1 · `chuong_trinh_tung_tham_gia[]` · `thanh_vien[]` 157 members (`ho_ten`, `vai_tro`, `don_vi_lam_viec_hoc_tap`, `kinh_nghiem_thanh_tich_khac`) |
| Hazards | one record's member names carry 4 phone numbers and 4 e-mail addresses (members left out); no markup found |

## Mapping (remote → view model → UI)
| Remote | View model | UI |
|---|---|---|
| `ten_startup` | `name` | card title, search |
| `mo_ta_ngan` | `tagline` | card body (3 lines) |
| `linh_vuc[]` | `domains` / `categories` | context label, 2 chips; Lĩnh vực facet and quick chips |
| `giai_doan_phat_trien` | `stage` | pill; Giai đoạn facet; default sort |
| `website` | `website` (http/https) | "Xem startup" in a new tab, else inert |
| `thanh_vien[]` | `memberCount`; founders (name, role, startups) | chip; Nhà sáng lập tab (84 after dedup) |

## Tabs and counts
Bài toán: DEMO FIXTURE (6; 4 open), labelled. Startup: startup.json (72). Nhà sáng lập: derived from startup.json (84). Hero: 4 · 72 · 84; never 28 / 142 / 310.

## UI remap (full frame, 1440 × 2470)
Light `#efefef` body; ink labels, muted counts and zeros; bordered checkboxes; facet note; per-tab facets (Startup: Lĩnh vực, Giai đoạn; founders: Lĩnh vực); toolbar with chips, "Xoá tất cả" and "Sắp xếp: … ▾"; 3 × 324 × 431 cards, 23 px gutter from x 358; 9 per page with an outlined "Xem thêm N …" 43 px below; page end 81 px below it. Chips, titles and taglines are clamped.

## QA (production build, local)
| Gate | Result |
|---|---|
| Pixel vs the full frame | P0 0 · P1 0 · P2 0; max outside 0.0111, max beyond 0.0114 (limits 0.015 / 0.02). Asserted: tab bar top 810, body 873, grid x 358, cards 324 × 431, gutter 23, load-more top 2340 ± 2 and centre 867 ± 2, page end 2470 ± 2 |
| P3 / intentional | digits of the counts, fixture names and counts, load-more label width, ticks on checked boxes |
| Responsive | 1440 (3 col) / 1024 (2) / 768 (1) / 390 (1): overflow 0, off-screen controls 0, card overflow 0; facets behind "Bộ lọc" under 900 px |
| Tests | `public-library` 13 / 13; regression 142 / 142 (P0-LANDING 10, P0-SHELL 14, shell-routes 33, WF01-S01 13, S02 14, S03 15, e-mail flow 5, auth-session 13, authz-session 8, console-health 4); unit 255 / 255 (adapter 10); `/about` 46 images, footer 8 / 8 |
| Gates / runtime | format, lint, typecheck, build PASS; #418 0; console errors 0; 4xx / 5xx 0 |

## Deploy note
The server must reach `startup.1hub.cloud` over HTTPS; if not, the two tabs show the error state (no 5xx). `LIBRARY_STARTUP_SOURCE_URL` can point elsewhere.

## Git
Branch `main`; start HEAD `c47fc92`, checked again before each commit. Push **NOT RUN**; deploy **NOT RUN**.

## Related
- [TASK-22-PREVIEW-LIBRARY_library.md](TASK-22-PREVIEW-LIBRARY_library.md)
